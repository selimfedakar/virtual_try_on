import {
  StyleSheet, Text, View, SafeAreaView, TextInput,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import AppHeader from '../../src/components/AppHeader';
import { useProfile } from '../../src/context/ProfileContext';

interface SizeRange { size: string; min: number; max: number; }

interface SizeResult {
  primary: string;
  secondary: string | null;
  primaryPct: number;
  secondaryPct: number;
}

interface GarmentSizeRec {
  label: string;           // "Tops" | "Bottoms"
  size: string;
  basis: string;           // which measurement drove the recommendation
  confidence: 'measured' | 'estimated';
}

interface FitResult {
  bmi: number;
  bmiCategory: string;
  bodyType: string;
  bodyDesc: string;
  sizeResult: SizeResult;
  garmentRecs: GarmentSizeRec[];
  fitTips: string[];
  wearThis: string[];
  avoid: string[];
}

// ── Standard unisex size chart (cm). Estimates only — brands vary. ──────────
interface SizeChartRow { size: string; chest: [number, number]; waist: [number, number]; hips: [number, number]; }

const SIZE_CHART: SizeChartRow[] = [
  { size: 'XS',  chest: [81, 86],   waist: [66, 71],   hips: [81, 86] },
  { size: 'S',   chest: [86, 94],   waist: [71, 79],   hips: [86, 94] },
  { size: 'M',   chest: [94, 102],  waist: [79, 87],   hips: [94, 102] },
  { size: 'L',   chest: [102, 110], waist: [87, 95],   hips: [102, 110] },
  { size: 'XL',  chest: [110, 118], waist: [95, 103],  hips: [110, 118] },
  { size: 'XXL', chest: [118, 130], waist: [103, 115], hips: [118, 130] },
];

function sizeFromMeasurement(valueCm: number, dim: 'chest' | 'waist' | 'hips'): string {
  for (const row of SIZE_CHART) {
    if (valueCm < row[dim][1]) return row.size;
  }
  return 'XXL';
}

const FEMALE_RANGES: SizeRange[] = [
  { size: 'XS', min: 0,   max: 48  },
  { size: 'S',  min: 48,  max: 56  },
  { size: 'M',  min: 56,  max: 65  },
  { size: 'L',  min: 65,  max: 75  },
  { size: 'XL', min: 75,  max: 88  },
  { size: 'XXL',min: 88,  max: 999 },
];
const MALE_RANGES: SizeRange[] = [
  { size: 'XS', min: 0,   max: 60  },
  { size: 'S',  min: 60,  max: 72  },
  { size: 'M',  min: 72,  max: 85  },
  { size: 'L',  min: 85,  max: 98  },
  { size: 'XL', min: 98,  max: 112 },
  { size: 'XXL',min: 112, max: 999 },
];

function getSizeResult(weight: number, gender: string): SizeResult {
  const ranges = gender === 'Female' ? FEMALE_RANGES : MALE_RANGES;
  let idx = ranges.findIndex(r => weight >= r.min && weight < r.max);
  if (idx === -1) idx = ranges.length - 1;

  const cur = ranges[idx];
  const span = cur.max === 999 ? 40 : cur.max - cur.min;
  const effMin = cur.min === 0 ? Math.max(0, cur.max - 40) : cur.min;
  const pos = Math.min(1, Math.max(0, (weight - effMin) / span));

  if (pos < 0.5 && idx > 0) {
    const secPct = Math.round((0.5 - pos) * 100);
    return { primary: cur.size, secondary: ranges[idx - 1].size, primaryPct: 100 - secPct, secondaryPct: secPct };
  }
  if (pos >= 0.5 && idx < ranges.length - 1) {
    const secPct = Math.round((pos - 0.5) * 100);
    return { primary: cur.size, secondary: ranges[idx + 1].size, primaryPct: 100 - secPct, secondaryPct: secPct };
  }
  return { primary: cur.size, secondary: null, primaryPct: 100, secondaryPct: 0 };
}

function calcBMI(weight: number, height: number) {
  return weight / Math.pow(height / 100, 2);
}

function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
}

function getBodyType(bmi: number, gender: string): { type: string; desc: string } {
  if (bmi < 18.5) return { type: 'Slim', desc: 'Lean and light build' };
  if (bmi < 21) return gender === 'Female'
    ? { type: 'Slim / Petite', desc: 'Light and delicate frame' }
    : { type: 'Slim / Lean', desc: 'Lean and defined physique' };
  if (bmi < 24) return gender === 'Female'
    ? { type: 'Athletic / Toned', desc: 'Well-proportioned and toned' }
    : { type: 'Athletic', desc: 'Muscular and well-defined' };
  if (bmi < 27) return gender === 'Female'
    ? { type: 'Average / Curvy', desc: 'Balanced with gentle curves' }
    : { type: 'Average / Stocky', desc: 'Solid and well-built' };
  if (bmi < 31) return gender === 'Female'
    ? { type: 'Curvy / Full', desc: 'Fuller figure with prominent curves' }
    : { type: 'Stocky / Broad', desc: 'Broad and powerful build' };
  return { type: 'Plus Size', desc: 'Full-figured and substantial build' };
}

function getFitAdvice(bodyType: string): { fitTips: string[]; wearThis: string[]; avoid: string[] } {
  const t = bodyType.toLowerCase();
  if (t.includes('slim') || t.includes('petite') || t.includes('lean'))
    return {
      fitTips: ['Slim and fitted styles work great for you.', 'Layering adds visual volume.'],
      wearThis: ['Slim-fit jeans', 'Tailored jackets', 'Fitted knitwear', 'Structured blazers'],
      avoid: ['Oversized silhouettes', 'Very baggy trousers'],
    };
  if (t.includes('athletic') || t.includes('toned'))
    return {
      fitTips: ['Your build suits most styles.', 'Shoulders may need extra room in jackets.'],
      wearThis: ['Straight-cut trousers', 'Fitted polos', 'V-neck tops', 'Stretchy performance wear'],
      avoid: ['Very tight chest cuts', 'Boxy tops that hide your shape'],
    };
  if (t.includes('average') || t.includes('stocky'))
    return {
      fitTips: ['Standard cuts fit you comfortably.', 'Vertical lines create a slimming effect.'],
      wearThis: ['Straight or slim-fit jeans', 'Button-down shirts', 'Dark colours', 'Monochrome looks'],
      avoid: ['Horizontal stripes', 'Very tight fits'],
    };
  if (t.includes('curvy') || t.includes('full'))
    return {
      fitTips: ['Define your waist for the best silhouette.', 'Wrap styles are very flattering.'],
      wearThis: ['Wrap dresses', 'High-waisted jeans', 'A-line skirts', 'Stretchy fabrics'],
      avoid: ['Boxy cuts without waist definition', 'Very tight bodycon'],
    };
  if (t.includes('broad'))
    return {
      fitTips: ['Look for relaxed fits with stretch.', 'Longer jackets balance proportions.'],
      wearThis: ['Dark jeans', 'Straight-leg trousers', 'Vertical prints', 'Longer cardigans'],
      avoid: ['Bright horizontal patterns', 'Very tight shirts'],
    };
  return {
    fitTips: ['Look for relaxed fits.', 'Stretchy fabrics add comfort.'],
    wearThis: ['Wide-leg trousers', 'Flowy tops', 'Stretchy denim', 'Longline cardigans'],
    avoid: ['Very structured stiff fabrics', 'Non-stretch tight fits'],
  };
}

interface Measurements {
  chest: number | null;
  waist: number | null;
  hips: number | null;
}

function getGarmentRecs(weight: number, gender: string, m: Measurements): GarmentSizeRec[] {
  const fallback = getSizeResult(weight, gender).primary;

  // Tops: chest measurement wins; otherwise the BMI/weight heuristic.
  const tops: GarmentSizeRec = m.chest
    ? { label: 'Tops', size: sizeFromMeasurement(m.chest, 'chest'), basis: `chest ${m.chest} cm`, confidence: 'measured' }
    : { label: 'Tops', size: fallback, basis: 'height & weight only', confidence: 'estimated' };

  // Bottoms: waist wins, hips break ties upward; otherwise heuristic.
  let bottoms: GarmentSizeRec;
  if (m.waist || m.hips) {
    const sizes = SIZE_CHART.map(r => r.size);
    const waistSize = m.waist ? sizeFromMeasurement(m.waist, 'waist') : null;
    const hipsSize = m.hips ? sizeFromMeasurement(m.hips, 'hips') : null;
    // If both provided, recommend the larger of the two (garment must fit both).
    let size: string;
    let basis: string;
    if (waistSize && hipsSize) {
      size = sizes.indexOf(hipsSize) > sizes.indexOf(waistSize) ? hipsSize : waistSize;
      basis = `waist ${m.waist} cm · hips ${m.hips} cm`;
    } else if (waistSize) {
      size = waistSize;
      basis = `waist ${m.waist} cm`;
    } else {
      size = hipsSize!;
      basis = `hips ${m.hips} cm`;
    }
    bottoms = { label: 'Bottoms', size, basis, confidence: 'measured' };
  } else {
    bottoms = { label: 'Bottoms', size: fallback, basis: 'height & weight only', confidence: 'estimated' };
  }

  return [tops, bottoms];
}

function analyze(
  height: string, weight: string, gender: string, m: Measurements,
): FitResult {
  const h = parseFloat(height);
  const w = parseFloat(weight);
  const bmi = Math.round(calcBMI(w, h) * 10) / 10;
  const { type, desc } = getBodyType(bmi, gender);
  return {
    bmi,
    bmiCategory: getBMICategory(bmi),
    bodyType: type,
    bodyDesc: desc,
    sizeResult: getSizeResult(w, gender),
    garmentRecs: getGarmentRecs(w, gender, m),
    ...getFitAdvice(type),
  };
}

const BMI_COLOR: Record<string, string> = {
  Underweight: '#60a5fa',
  Normal: '#22c55e',
  Overweight: '#f59e0b',
  Obese: '#ef4444',
};

function isValidHeight(v: string) {
  const n = parseFloat(v);
  return !isNaN(n) && n >= 50 && n <= 250;
}
function isValidWeight(v: string) {
  const n = parseFloat(v);
  return !isNaN(n) && n >= 20 && n <= 300;
}
function isValidGirth(v: string) {
  if (v === '') return true; // optional
  const n = parseFloat(v);
  return !isNaN(n) && n >= 40 && n <= 200;
}
function parseOptional(v: string): number | null {
  const n = parseFloat(v);
  return v !== '' && !isNaN(n) ? n : null;
}

export default function Analysis() {
  const { profile, updateProfile } = useProfile();
  const [height, setHeight] = useState(profile.height);
  const [weight, setWeight] = useState(profile.weight);
  const [gender, setGender] = useState(profile.gender || 'Male');
  const [chest, setChest] = useState(profile.chest);
  const [waist, setWaist] = useState(profile.waist);
  const [hips, setHips] = useState(profile.hips);
  const [result, setResult] = useState<FitResult | null>(null);
  const [heightErr, setHeightErr] = useState('');
  const [weightErr, setWeightErr] = useState('');
  const [girthErr, setGirthErr] = useState('');
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    setHeight(profile.height);
    setWeight(profile.weight);
    setGender(profile.gender || 'Male');
    setChest(profile.chest);
    setWaist(profile.waist);
    setHips(profile.hips);
  }, [profile.height, profile.weight, profile.gender, profile.chest, profile.waist, profile.hips]);

  const handleAnalyze = () => {
    let valid = true;
    if (!isValidHeight(height)) {
      setHeightErr('Enter a height between 50 and 250 cm');
      valid = false;
    } else {
      setHeightErr('');
    }
    if (!isValidWeight(weight)) {
      setWeightErr('Enter a weight between 20 and 300 kg');
      valid = false;
    } else {
      setWeightErr('');
    }
    if (!isValidGirth(chest) || !isValidGirth(waist) || !isValidGirth(hips)) {
      setGirthErr('Measurements must be between 40 and 200 cm (or left empty)');
      valid = false;
    } else {
      setGirthErr('');
    }
    if (!valid) return;

    // Computed locally — results are instant, no artificial delay.
    setResult(analyze(height, weight, gender, {
      chest: parseOptional(chest),
      waist: parseOptional(waist),
      hips: parseOptional(hips),
    }));
    updateProfile({ height, weight, gender, chest, waist, hips }).catch(() => {});
  };

  const canAnalyze = height.length > 0 && weight.length > 0;
  const bmiColor = result ? BMI_COLOR[result.bmiCategory] : '#22c55e';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Fit Analysis</Text>
          <Text style={styles.subtitle}>Find your perfect size</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Measurements</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={[styles.input, heightErr ? styles.inputError : null]} keyboardType="numeric"
                placeholder="e.g. 175" placeholderTextColor="#52525b"
                value={height} onChangeText={v => { setHeight(v); setHeightErr(''); }} maxLength={3}
              />
              {!!heightErr && <Text style={styles.fieldError}>{heightErr}</Text>}
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, weightErr ? styles.inputError : null]} keyboardType="numeric"
                placeholder="e.g. 70" placeholderTextColor="#52525b"
                value={weight} onChangeText={v => { setWeight(v); setWeightErr(''); }} maxLength={3}
              />
              {!!weightErr && <Text style={styles.fieldError}>{weightErr}</Text>}
            </View>
          </View>

          {/* Optional girth measurements */}
          <Text style={styles.optionalLabel}>OPTIONAL — FOR A MORE ACCURATE SIZE</Text>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Chest (cm)</Text>
              <TextInput
                style={[styles.input, girthErr ? styles.inputError : null]} keyboardType="numeric"
                placeholder="e.g. 96" placeholderTextColor="#52525b"
                value={chest} onChangeText={v => { setChest(v); setGirthErr(''); }} maxLength={3}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Waist (cm)</Text>
              <TextInput
                style={[styles.input, girthErr ? styles.inputError : null]} keyboardType="numeric"
                placeholder="e.g. 82" placeholderTextColor="#52525b"
                value={waist} onChangeText={v => { setWaist(v); setGirthErr(''); }} maxLength={3}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Hips (cm)</Text>
              <TextInput
                style={[styles.input, girthErr ? styles.inputError : null]} keyboardType="numeric"
                placeholder="e.g. 98" placeholderTextColor="#52525b"
                value={hips} onChangeText={v => { setHips(v); setGirthErr(''); }} maxLength={3}
              />
            </View>
          </View>
          {!!girthErr && <Text style={styles.fieldError}>{girthErr}</Text>}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.toggleContainer}>
              {(['Male', 'Female', 'Other'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.toggleButton, gender === g && styles.toggleActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={gender === g ? styles.toggleTextActive : styles.toggleText}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !canAnalyze && { opacity: 0.45 }]}
          onPress={handleAnalyze}
          disabled={!canAnalyze}
        >
          <Text style={styles.primaryButtonText}>Analyze My Fit</Text>
        </TouchableOpacity>

        {result && (
          <View style={styles.results}>

            {/* Per-garment size recommendations */}
            <View style={styles.garmentRecCard}>
              <Text style={styles.garmentRecHeader}>SIZE BY GARMENT TYPE</Text>
              <View style={styles.garmentRecRow}>
                {result.garmentRecs.map((rec, i) => (
                  <View key={i} style={styles.garmentRecCell}>
                    <Text style={styles.garmentRecLabel}>{rec.label.toUpperCase()}</Text>
                    <Text style={styles.garmentRecSize}>{rec.size}</Text>
                    <View style={[
                      styles.confidenceBadge,
                      rec.confidence === 'measured' ? styles.confidenceMeasured : styles.confidenceEstimated,
                    ]}>
                      <Text style={[
                        styles.confidenceText,
                        { color: rec.confidence === 'measured' ? '#22c55e' : '#f59e0b' },
                      ]}>
                        {rec.confidence === 'measured' ? 'MEASURED' : 'ESTIMATE'}
                      </Text>
                    </View>
                    <Text style={styles.garmentRecBasis}>Based on {rec.basis}</Text>
                  </View>
                ))}
              </View>
              {result.garmentRecs.some(r => r.confidence === 'estimated') && (
                <Text style={styles.garmentRecHint}>
                  Add chest, waist and hips above for measurement-based recommendations.
                </Text>
              )}
              <Text style={styles.disclaimer}>
                Sizes are estimates against a standard unisex chart — actual fit varies by brand.
              </Text>
            </View>

            {/* BMI Card */}
            <View style={[styles.resultCard, { borderColor: bmiColor + '44' }]}>
              <View style={styles.topMetrics}>
                <View style={styles.bmiBlock}>
                  <Text style={[styles.bmiNumber, { color: bmiColor }]}>{result.bmi}</Text>
                  <Text style={[styles.bmiCat, { color: bmiColor }]}>{result.bmiCategory}</Text>
                  <Text style={styles.bmiLabel}>BMI</Text>
                </View>

                {/* Size Range Display */}
                <View style={styles.sizeBlock}>
                  <Text style={styles.sizeMeta}>OVERALL SIZE</Text>
                  <View style={styles.sizeRow}>
                    <View style={styles.sizeItemWrap}>
                      {result.sizeResult.primaryPct < 100 && (
                        <Text style={styles.sizePctLeft}>{result.sizeResult.primaryPct}%</Text>
                      )}
                      <Text style={styles.sizePrimary}>{result.sizeResult.primary}</Text>
                    </View>

                    {result.sizeResult.secondary && (
                      <>
                        <Text style={styles.sizeDash}>—</Text>
                        <View style={styles.sizeItemWrap}>
                          <Text style={styles.sizePctRight}>{result.sizeResult.secondaryPct}%</Text>
                          <Text style={styles.sizeSecondary}>{result.sizeResult.secondary}</Text>
                        </View>
                      </>
                    )}
                  </View>
                  {result.sizeResult.secondary && (
                    <Text style={styles.sizeNote}>
                      You're between {result.sizeResult.primary} and {result.sizeResult.secondary}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.bodyTypeRow}>
                <Text style={styles.bodyType}>{result.bodyType}</Text>
                <Text style={styles.bodyDesc}>{result.bodyDesc}</Text>
              </View>
            </View>

            {/* Size chart reference */}
            <TouchableOpacity style={styles.chartToggle} onPress={() => setShowChart(s => !s)}>
              <Text style={styles.chartToggleText}>
                {showChart ? 'Hide size chart' : 'View size chart (cm)'}
              </Text>
            </TouchableOpacity>
            {showChart && (
              <View style={styles.chartCard}>
                <View style={styles.chartRow}>
                  <Text style={[styles.chartHeadCell, { flex: 0.8 }]}>SIZE</Text>
                  <Text style={styles.chartHeadCell}>CHEST</Text>
                  <Text style={styles.chartHeadCell}>WAIST</Text>
                  <Text style={styles.chartHeadCell}>HIPS</Text>
                </View>
                {SIZE_CHART.map(row => (
                  <View key={row.size} style={styles.chartRow}>
                    <Text style={[styles.chartCell, { flex: 0.8, fontWeight: '700', color: '#ffffff' }]}>{row.size}</Text>
                    <Text style={styles.chartCell}>{row.chest[0]}–{row.chest[1]}</Text>
                    <Text style={styles.chartCell}>{row.waist[0]}–{row.waist[1]}</Text>
                    <Text style={styles.chartCell}>{row.hips[0]}–{row.hips[1]}</Text>
                  </View>
                ))}
                <Text style={styles.disclaimer}>Standard unisex chart — estimates vary by brand.</Text>
              </View>
            )}

            <View style={styles.adviceCard}>
              <Text style={styles.adviceTitle}>💡 Fit Tips</Text>
              {result.fitTips.map((tip, i) => <Text key={i} style={styles.adviceItem}>• {tip}</Text>)}
            </View>

            <View style={styles.adviceCard}>
              <Text style={styles.adviceTitle}>✅ Works Well For You</Text>
              {result.wearThis.map((item, i) => <Text key={i} style={styles.adviceItem}>• {item}</Text>)}
            </View>

            <View style={[styles.adviceCard, { borderColor: '#3f1a1a' }]}>
              <Text style={styles.adviceTitle}>⚠️ Might Be Tricky</Text>
              {result.avoid.map((item, i) => (
                <Text key={i} style={[styles.adviceItem, { color: '#a1a1aa' }]}>• {item}</Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 15, color: '#a1a1aa', fontWeight: '500', marginTop: 4 },
  card: {
    backgroundColor: '#18181b', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#27272a', marginBottom: 20,
  },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#ffffff', marginBottom: 18 },
  row: { flexDirection: 'row', marginBottom: 0 },
  inputGroup: { marginBottom: 16 },
  label: { color: '#a1a1aa', fontSize: 13, marginBottom: 8, fontWeight: '500' },
  optionalLabel: {
    color: '#52525b', fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    marginBottom: 10, marginTop: 2,
  },
  input: {
    backgroundColor: '#000000', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 16,
  },
  inputError: { borderColor: '#ef4444' },
  fieldError: { color: '#ef4444', fontSize: 11, marginTop: 4, marginBottom: 8 },
  toggleContainer: {
    flexDirection: 'row', backgroundColor: '#000000',
    borderRadius: 12, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden',
  },
  toggleButton: { flex: 1, padding: 14, alignItems: 'center' },
  toggleActive: { backgroundColor: '#ffffff' },
  toggleText: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#000000', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#ffffff', padding: 18, borderRadius: 100,
    alignItems: 'center', marginBottom: 24,
  },
  primaryButtonText: { color: '#000000', fontSize: 17, fontWeight: 'bold' },
  results: { gap: 14 },

  // Per-garment recommendations
  garmentRecCard: {
    backgroundColor: '#0a1b2e', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#1e4878',
  },
  garmentRecHeader: {
    color: '#4a90d0', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 16,
  },
  garmentRecRow: { flexDirection: 'row', gap: 14 },
  garmentRecCell: {
    flex: 1, alignItems: 'center', backgroundColor: 'rgba(74,144,208,0.08)',
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(74,144,208,0.2)',
  },
  garmentRecLabel: { color: '#7eb8d6', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  garmentRecSize: { color: '#ffffff', fontSize: 36, fontWeight: '900', lineHeight: 42, marginBottom: 8 },
  confidenceBadge: {
    borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginBottom: 6,
  },
  confidenceMeasured: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.35)' },
  confidenceEstimated: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.35)' },
  confidenceText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  garmentRecBasis: { color: '#4a80a8', fontSize: 10, textAlign: 'center', lineHeight: 14 },
  garmentRecHint: { color: '#4a80a8', fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 16 },
  disclaimer: { color: '#3f5a75', fontSize: 10, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },

  // Result card
  resultCard: {
    backgroundColor: '#0d150d', borderRadius: 20, padding: 20,
    borderWidth: 1,
  },
  topMetrics: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 16, gap: 16,
  },
  bmiBlock: { alignItems: 'center', minWidth: 72 },
  bmiNumber: { fontSize: 38, fontWeight: '900', lineHeight: 42 },
  bmiCat: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  bmiLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },

  sizeBlock: { flex: 1, alignItems: 'center' },
  sizeMeta: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  sizeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  sizeItemWrap: { alignItems: 'center', position: 'relative' },
  sizePrimary: { fontSize: 44, fontWeight: '900', color: '#ffffff', lineHeight: 50 },
  sizeSecondary: { fontSize: 30, fontWeight: '700', color: '#555', lineHeight: 36 },
  sizeDash: { color: '#333', fontSize: 20, marginBottom: 4 },
  sizePctLeft: {
    position: 'absolute', top: 0, left: -2,
    color: '#777', fontSize: 9, fontWeight: '700',
  },
  sizePctRight: {
    position: 'absolute', top: 0, right: -2,
    color: '#555', fontSize: 9, fontWeight: '700',
  },
  sizeNote: { color: '#555', fontSize: 10, marginTop: 6, textAlign: 'center' },

  bodyTypeRow: { alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1a2a1a' },
  bodyType: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  bodyDesc: { color: '#a1a1aa', fontSize: 13, marginTop: 4 },

  // Size chart
  chartToggle: { alignItems: 'center', paddingVertical: 4 },
  chartToggleText: { color: '#4a90d0', fontSize: 13, fontWeight: '600' },
  chartCard: {
    backgroundColor: '#0d0d0d', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1a1a1a',
  },
  chartRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#161616',
  },
  chartHeadCell: {
    flex: 1, color: '#52525b', fontSize: 10, fontWeight: '700', letterSpacing: 1,
    textAlign: 'center',
  },
  chartCell: { flex: 1, color: '#a1a1aa', fontSize: 12, textAlign: 'center' },

  adviceCard: {
    backgroundColor: '#18181b', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#27272a',
  },
  adviceTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  adviceItem: { color: '#d4d4d8', fontSize: 14, lineHeight: 22, marginBottom: 4 },
});
