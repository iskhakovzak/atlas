'use client';
import {StorageNotice} from './storage-notice';
import {PerformanceProbe} from './performance-probe';
import {ImpactTracking} from './impact-tracking';

/** Loaded by app/shell-extras.tsx right after hydration; same order as they had in the layout. */
export function ShellExtrasParts(){return <><StorageNotice/><PerformanceProbe/><ImpactTracking/></>}
