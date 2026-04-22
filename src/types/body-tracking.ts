// ============================================================
// Body Tracking — TypeScript Interfaces
// ============================================================

export interface BodyScan {
  id: string;
  date: string;             // "YYYY-MM-DD"
  weightLbs: number | null;
  waistCm: number | null;
  shoulderCm: number | null;
  photoFrontUrl: string | null;
  photoSideLeftUrl: string | null;
  photoSideRightUrl: string | null;
  photoBackUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateBodyScanInput {
  date: string;
  weightLbs?: number | null;
  waistCm?: number | null;
  shoulderCm?: number | null;
  photoFrontUrl?: string | null;
  photoSideLeftUrl?: string | null;
  photoSideRightUrl?: string | null;
  photoBackUrl?: string | null;
  notes?: string | null;
}

export interface UpdateBodyScanInput {
  date?: string;
  weightLbs?: number;
  waistCm?: number;
  shoulderCm?: number | null;
  photoFrontUrl?: string | null;
  photoSideLeftUrl?: string | null;
  photoSideRightUrl?: string | null;
  photoBackUrl?: string | null;
  notes?: string | null;
}

export interface BodyScanListResponse {
  scans: BodyScan[];
  total: number;
}

export interface BodyScanResponse {
  scan: BodyScan;
}

export type PhotoAngle = 'front' | 'side_left' | 'side_right' | 'back';

export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Front',
  side_left: 'Left Side',
  side_right: 'Right Side',
  back: 'Back',
};

export type MeasurementUnit = 'cm' | 'inches';

/** @deprecated Use MeasurementUnit */
export type WaistUnit = MeasurementUnit;

export interface ScanWithRatio extends BodyScan {
  waistToWeightRatio: number;
  shoulderToWaistRatio: number | null;
}

export interface TrendChartsProps {
  scans: BodyScan[];
  targetWeightLbs?: number;
  targetWaistCm?: number;
  targetShoulderCm?: number;
}

export interface ScanHistoryGridProps {
  scans: BodyScan[];
  onScanClick?: (scan: BodyScan) => void;
}

export interface BodyScanCaptureProps {
  onPhotosChange: (photos: Partial<Record<PhotoAngle, File>>) => void;
  existingPhotos?: Partial<Record<PhotoAngle, string>>;
}

export interface BodyScanFormProps {
  onSuccess?: (scan: BodyScan) => void;
  initialData?: Partial<CreateBodyScanInput>;
}
