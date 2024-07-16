[![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png)](#table-of-contents)
# Baileys Session (MongoDB)
> multi session baileys created on mongodb databases

[JOIN GROUP](https://chat.whatsapp.com/JbzMsezhCwUKdC6dnjwcIz)

## how to use ?
> First, you need to add the session package in package.json. You can use the github or npm version
```json
{
    "name": "myproject",
    "version": "1.0.1",
    "author": "Sherly",
    "dependencies": {
        "session": "github:amiruldev20/baileys-session#mongodb"
        // and other your depen
    }
}
```

> Second step, please call the useMongoAuthState function on your client. Example code is below

```javascript
// for esm import
import { useMongoAuthState } from "session"

// for cjs import
const { useMongoAuthState } = require("session")

// next code (support all)
const { state, saveCreds, clear, removeCreds, query } =
    await useMongoAuthState("urlmongo")
```

**Note:**
> If there are bugs, please report & open an issue in the main repo.
