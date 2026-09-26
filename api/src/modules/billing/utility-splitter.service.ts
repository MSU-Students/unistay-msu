import { Injectable } from '@nestjs/common';

export interface UtilitySplitInput {
  totalElectricBill: number;
  totalWaterBill: number;
  occupantCount: number;
  roomSpecificKwhRate?: number;
  subMeterReadings?: {
    tenantId: string;
    previousKwh: number;
    currentKwh: number;
  }[];
}

export interface SplitResult {
  tenantId?: string;
  electricShare: number;
  waterShare: number;
  totalUtilityShare: number;
  formulaNote: string;
}

@Injectable()
export class UtilitySplitterService {
  /**
   * Calculates equitable splitting for shared utilities across dormitory or boarding house occupants.
   */
  calculateEqualSplit(input: {
    totalElectric: number;
    totalWater: number;
    occupantCount: number;
  }): SplitResult {
    const { totalElectric, totalWater, occupantCount } = input;
    if (occupantCount <= 0) {
      return {
        electricShare: 0,
        waterShare: 0,
        totalUtilityShare: 0,
        formulaNote: 'No active occupants recorded.',
      };
    }

    const electricShare = Number((totalElectric / occupantCount).toFixed(2));
    const waterShare = Number((totalWater / occupantCount).toFixed(2));
    const totalUtilityShare = Number((electricShare + waterShare).toFixed(2));

    return {
      electricShare,
      waterShare,
      totalUtilityShare,
      formulaNote: `Shared equally across ${occupantCount} occupants: Electric ₱${electricShare} + Water ₱${waterShare}`,
    };
  }

  /**
   * Calculates sub-metered electricity plus equally divided common water.
   */
  calculateSubmeteredSplit(
    subMeter: { previousKwh: number; currentKwh: number; ratePerKwh: number },
    waterPerPerson: number,
  ): SplitResult {
    const consumedKwh = Math.max(0, subMeter.currentKwh - subMeter.previousKwh);
    const electricShare = Number((consumedKwh * subMeter.ratePerKwh).toFixed(2));
    const waterShare = Number(waterPerPerson.toFixed(2));
    const totalUtilityShare = Number((electricShare + waterShare).toFixed(2));

    return {
      electricShare,
      waterShare,
      totalUtilityShare,
      formulaNote: `Sub-meter: ${consumedKwh} kWh @ ₱${subMeter.ratePerKwh}/kWh (₱${electricShare}) + Shared Water (₱${waterShare})`,
    };
  }
}
