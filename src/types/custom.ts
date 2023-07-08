export enum Mode {
    max = 'max',
    pad = 'pad',
    crop = 'crop',
    stretch = 'stretch',
}

export enum Scale {
    down = 'down',
    both = 'both',
    canvas = 'canvas',
}

export interface Instructions {
    h?: number
    height?: number
    w?: number
    width?: number
    mode?: Mode
    scale?: Scale
    v?: number
}
