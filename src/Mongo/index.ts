import mongoose from "mongoose";
import AsyncLock from "async-lock";
import {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap
} from "../Types";
import { initAuthCreds } from "./auth-utils";
import * as bail from "baileys"
const fileLock = new AsyncLock({ maxPending: Infinity });

const BufferJSON = {
    replacer: (k, value: any) => {
        if (
            Buffer.isBuffer(value) ||
            value instanceof Uint8Array ||
            value?.type === "Buffer"
        ) {
            return {
                type: "Buffer",
                data: Buffer.from(value?.data || value).toString("base64")
            };
        }
        return value;
    },
    reviver: (_, value: any) => {
        if (
            typeof value === "object" &&
            !!value &&
            (value.buffer === true || value.type === "Buffer")
        ) {
            const val = value.data || value.value;
            return typeof val === "string"
                ? Buffer.from(val, "base64")
                : Buffer.from(val || []);
        }
        return value;
    }
};

const sessionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    value: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, expires: "5m", default: Date.now } // TTL index 5 minutes
});

const Session = mongoose.model("Session", sessionSchema);

export const useMongoAuthState = async (
    mongoURI: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
    await mongoose.connect(mongoURI);

    const writeData = (data: any, file: string) => {
        const id = file.replace(/\//g, "__").replace(/:/g, "-");
        return fileLock.acquire(id, () =>
            Session.updateOne(
                { _id: id },
                { value: data, createdAt: new Date() },
                { upsert: true }
            )
        );
    };

    const readData = async (file: string) => {
        try {
            const id = file.replace(/\//g, "__").replace(/:/g, "-");
            const doc = await fileLock.acquire(id, () =>
                Session.findById(id).exec()
            );
            return doc
                ? JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver)
                : null;
        } catch (error) {
            return null;
        }
    };

    const removeData = async (file: string) => {
        try {
            const id = file.replace(/\//g, "__").replace(/:/g, "-");
            await fileLock.acquire(id, () =>
                Session.deleteOne({ _id: id }).exec()
            );
        } catch {}
    };

    const creds: AuthenticationCreds =
        (await readData("creds.json")) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: {
                        [_: string]: SignalDataTypeMap[typeof type];
                    } = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}.json`);
                            if (type === "app-state-sync-key" && value) {
                                value =
                                    bail.proto.Message.AppStateSyncKeyData.fromObject(
                                        value
                                    );
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async data => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}.json`;
                            tasks.push(
                                value
                                    ? writeData(value, file)
                                    : removeData(file)
                            );
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, "creds.json");
        }
    };
};