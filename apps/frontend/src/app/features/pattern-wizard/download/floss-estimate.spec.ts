import { describe, expect, it } from 'vitest';
import { estimateFloss } from './floss-estimate';

describe('estimateFloss', () => {
  it('stima ~1 matassina per ~1300 punti su Aida 14 a 2 capi', () => {
    const est = estimateFloss({ stitches: 1300, fabricCount: 14, strands: 2 });
    expect(est.skeins).toBe(1);
    expect(est.meters).toBeGreaterThan(9);
    expect(est.meters).toBeLessThan(14);
  });

  it('più punti richiedono più matassine', () => {
    const small = estimateFloss({ stitches: 1000, fabricCount: 14, strands: 2 });
    const big = estimateFloss({ stitches: 6000, fabricCount: 14, strands: 2 });
    expect(big.skeins).toBeGreaterThan(small.skeins);
    expect(big.meters).toBeGreaterThan(small.meters);
  });

  it('più capi = più consumo (più matassine)', () => {
    const two = estimateFloss({ stitches: 4000, fabricCount: 14, strands: 2 });
    const three = estimateFloss({ stitches: 4000, fabricCount: 14, strands: 3 });
    expect(three.skeins).toBeGreaterThanOrEqual(two.skeins);
    // i metri ricamati non dipendono dai capi (stesso percorso)
    expect(three.meters).toBeCloseTo(two.meters, 5);
  });

  it('count più fine consuma meno filo per punto', () => {
    const aida11 = estimateFloss({ stitches: 2000, fabricCount: 11, strands: 2 });
    const aida18 = estimateFloss({ stitches: 2000, fabricCount: 18, strands: 2 });
    expect(aida18.meters).toBeLessThan(aida11.meters);
  });

  it('con zero punti non serve filato', () => {
    expect(estimateFloss({ stitches: 0, fabricCount: 14, strands: 2 })).toEqual({
      meters: 0,
      skeins: 0,
    });
  });

  it('almeno una matassina anche per pochi punti', () => {
    const est = estimateFloss({ stitches: 5, fabricCount: 14, strands: 2 });
    expect(est.skeins).toBe(1);
  });
});
