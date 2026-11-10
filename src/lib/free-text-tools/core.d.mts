export const MAX_TEXT: number;
export interface DiffRow {kind:'same'|'removed'|'added';text:string;before?:number;after?:number}
export interface Cue {start:number;end:number;text:string}
export function diffLines(before:string,after:string):DiffRow[];
export function parseTime(value:string):number;
export function parseSubtitles(source:string):Cue[];
export function shiftSubtitles(cues:Cue[],seconds:number):Cue[];
export function serializeSubtitles(cues:Cue[],format?:'srt'|'vtt'):string;
