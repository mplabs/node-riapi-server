export function toBase64U(data: string): string {
    return Buffer.from(data)
        .toString('base64')
        .replaceAll('=', '')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
}

export function fromBase64U(data: string): string {
    data = data.padEnd(data.length + ((4 - (data.length % 4)) % 4), '=')
    return Buffer.from(data.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf-8')
}
