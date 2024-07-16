import mongoose from "mongoose";
import { BufferJSON, initAuthCreds, fromObject } from "../Utils";
import {
    mongoConfig,
    mongoData,
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap
} from "../Types";

const sessionSchema = new mongoose.Schema({
    _id: String,
    value: mongoose.Schema.Types.Mixed,
    session: String
});

const Session = mongoose.model("Session", sessionSchema);

export const useMongoAuthState = async (mongoURI: string, config: mongoConfig): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    clear: () => Promise<void>;
    removeCreds: () => Promise<void>;
    query: (collection: string, docId: string) => Promise<mongoData>;
}> => {
    await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const collectionName = config.tableName || "amiruldev-auth";
    const session = config.session || "amiruldev-waAuth";

    const query = async (collection: string, docId: string): Promise<mongoData> => {
        const doc = await Session.findById(`${session}-${docId}`);
        return doc ? doc.toObject() as mongoData : {} as mongoData;
    };

    const readData = async (id: string) => {
        const data = await query(collectionName, id);
        if (!data.value) {
            return null;
        }
        const creds = typeof data.value === "object"
            ? JSON.stringify(data.value)
            : data.value;
        return JSON.parse(creds, BufferJSON.reviver);
    };

    const writeData = async (id: string, value: object) => {
        const valueFixed = JSON.stringify(value, BufferJSON.replacer);
        await Session.updateOne(
            { _id: `${session}-${id}` },
            { value: valueFixed, session },
            { upsert: true }
        );
    };

    const removeData = async (id: string) => {
        await Session.deleteOne({ _id: `${session}-${id}` });
    };

    const clearAll = async () => {
        await Session.deleteMany({ session, _id: { $ne: "creds" } });
    };

    const removeAll = async () => {
        await Session.deleteMany({ session });
    };

    const creds: AuthenticationCreds = (await readData("creds")) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: {
                        [id: string]: SignalDataTypeMap[typeof type];
                    } = {};
                    for (const id of ids) {
                        let value = await readData(`${type}-${id}`);
                        if (type === "app-state-sync-key" && value) {
                            value = fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async data => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const name = `${category}-${id}`;
                            if (value) {
                                await writeData(name, value);
                            } else {
                                await removeData(name);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData("creds", creds);
        },
        clear: async () => {
            await clearAll();
        },
        removeCreds: async () => {
            await removeAll();
        },
        query: async (collection: string, docId: string) => {
            return await query(collection, docId);
        }
    };
};
