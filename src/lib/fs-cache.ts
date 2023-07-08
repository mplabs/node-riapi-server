import fs from 'fs/promises'
import { resolve as resolvePath } from 'path'

const MAX_SAFE_DATE = 8640000000000

export interface CacheValue {
    time: number
    value: unknown
}

export interface FsCacheOptions {
    cachePath: string
}

function fsCache({ cachePath }: FsCacheOptions) {
    const _cache = new Map<string, CacheValue>()

    // Populate cache
    fs.readdir(cachePath).then(async (files) => {
        for (const file of files) {
            const { key, time } = file.match(/^(?<key>[^.]+)\.(?<time>\d{10,13})$/)?.groups as {
                key: string
                time: string
            }

            // This is some other file, skip
            if (!key || !time) {
                continue
            }

            // value expired, delete
            if (parseInt(time) < Date.now() / 1000) {
                await _delete(resolvePath(cachePath, file))
                continue
            }

            try {
                // value still valid, add to cache
                _cache.set(key, {
                    time: parseInt(time),
                    value: await fs.readFile(resolvePath(cachePath, file), 'utf-8'),
                })
            } catch (error) {
                console.error(error)
            }

            console.log({ key, cacheValue: _cache.get(key) })
        }
    })

    async function _delete(path: string) {
        return await fs.unlink(resolvePath(cachePath, path))
    }

    const put = (key: string, value: string | Buffer, time: number = MAX_SAFE_DATE) => {
        if (time < Date.now() / 1000 || time > MAX_SAFE_DATE) {
            throw new Error(`Time ${time} is in the past or too far in the future.`)
        }

        time = Math.floor(time)

        _cache.set(key, { time, value })
        try {
            fs.writeFile(resolvePath(cachePath, `${key}.${time}`), value)
        } catch (error) {
            throw new Error(`Could not write to cache: ${error}`)
        }
        return value
    }

    const get = (key: string) => {
        return _cache.get(key)?.value || null
    }

    const del = (key: string) => {
        const { time } = _cache.get(key) || {}
        if (!time) {
            throw new Error(`Time for key ${key} not found in cache.`)
        }
        _delete(resolvePath(cachePath, `${key}.${time}`)).then(() => {
            _cache.delete(key)
        })
    }

    const clear = () => {
        _cache.forEach((_, key) => del(key))
    }

    const size = () => {
        return _cache.size
    }

    const keys = () => {
        return _cache.keys()
    }

    return { put, get, del, clear, size, keys }
}

export default fsCache
