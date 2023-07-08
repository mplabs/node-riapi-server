// https://blog.logrocket.com/extend-express-request-object-typescript/#extending-the-express-request-type-in-typescript

import { Instructions } from '../custom'

// to make the file a module and avoid the TypeScript error
export {}

declare global {
    namespace Express {
        export interface Request {
            instructions?: Instructions
        }
    }
}
