const fs = require('fs');
const path = require('path');
const { uploadFile } = require('./storage.service');
const settingsService = require('./settings.service');

const getApiKey = async () => {
  return await settingsService.getSetting('gemini_api_key', process.env.GEMINI_API_KEY);
};

const MOCK_MOCKUP_IMAGES = {
  mini_figure:
    'https://images.unsplash.com/photo-1608889175123-8ec330b86f84?auto=format&fit=crop&q=80&w=600&h=600',
  bag: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=600&h=600',
  hat: 'https://images.unsplash.com/photo-1575424909138-46b05e5919ec?auto=format&fit=crop&q=80&w=600&h=600',
};

const MINI_FIGURE_OPTIONS = ['pants', 'shirt', 'hat', 'hair', 'bag', 'scarf', 'handAccessory'];
const MINI_FIGURE_KEYWORDS = {
  pants: ['pants', 'trousers', 'jeans', 'shorts', 'skirt', 'quan', 'vay'],
  shirt: ['shirt', 't-shirt', 'tee', 'hoodie', 'jacket', 'coat', 'sweater', 'ao'],
  hat: ['hat', 'cap', 'beanie', 'mu'],
  hair: ['hair', 'hairstyle', 'pony', 'braid', 'bang', 'toc'],
  bag: ['bag', 'backpack', 'tui'],
  scarf: ['scarf', 'khan'],
  handAccessory: ['hand accessory', 'handheld', 'held', 'prop', 'cam tay'],
};
const BAG_HAT_PATTERN_KEYWORDS = [
  'pattern',
  'print',
  'logo',
  'illustration',
  'graphic',
  'drawing',
  'motif',
  'icon',
  'cartoon',
  'hoa tiet',
  'hoa van',
  'hinh ve',
];

const normalizeForCompare = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const splitSentences = (text) => {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];

  const parts = clean.split(/([.!?])\s+/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = `${parts[i] || ''}${parts[i + 1] || ''}`.trim();
    if (sentence) sentences.push(sentence);
  }

  return sentences.length ? sentences : [clean];
};

const containsAnyKeyword = (text, keywords) => {
  const normalized = normalizeForCompare(text);
  return keywords.some((keyword) => normalized.includes(keyword));
};

const filterSentencesByKeywords = (text, keywords) => {
  if (!text || !keywords.length) return '';
  const sentences = splitSentences(text);
  const kept = sentences.filter((sentence) => containsAnyKeyword(sentence, keywords));
  return kept.join(' ').trim();
};

const removeSentencesByKeywords = (text, keywords) => {
  if (!text || !keywords.length) return String(text || '');
  const sentences = splitSentences(text);
  const kept = sentences.filter((sentence) => !containsAnyKeyword(sentence, keywords));
  return kept.join(' ').trim();
};

const getSelectedMiniFigureOptions = (options = {}) =>
  MINI_FIGURE_OPTIONS.filter((key) => Boolean(options[key]));

const sanitizeOptimizedPrompt = (optimizedPrompt, productType, options = {}) => {
  if (typeof optimizedPrompt !== 'string') return optimizedPrompt;
  let cleaned = optimizedPrompt.trim();
  if (!cleaned) return optimizedPrompt;

  if (productType === 'mini_figure') {
    const selected = new Set(getSelectedMiniFigureOptions(options));
    const disallowedKeywords = MINI_FIGURE_OPTIONS.filter((key) => !selected.has(key)).flatMap(
      (key) => MINI_FIGURE_KEYWORDS[key] || []
    );
    cleaned = removeSentencesByKeywords(cleaned, disallowedKeywords) || cleaned;
  }

  if ((productType === 'bag' || productType === 'hat') && !options.illustration) {
    cleaned = removeSentencesByKeywords(cleaned, BAG_HAT_PATTERN_KEYWORDS) || cleaned;
  }

  return cleaned;
};

/**
 * Parses user input features and text prompt into a structured design representation using Gemini.
 * Falls back to basic prompt construction if no API key is provided.
 */
const parsePrompt = async (productType, options = {}, customPrompt = '') => {
  const selectedAccessories = getSelectedMiniFigureOptions(options);
  const colorPreference =
    typeof options.color === 'string' && options.color.trim() ? options.color.trim() : '';
  const illustrationAllowed = Boolean(options.illustration);

  // Load reference image
  let referenceImagePart = null;
  try {
    const filename = productType === 'mini_figure' ? 'mini_figure.png' : `${productType}.png`;
    const imagePath = path.join(__dirname, '..', 'assets', 'ai-references', filename);
    if (fs.existsSync(imagePath)) {
      const fileBuffer = fs.readFileSync(imagePath);
      referenceImagePart = {
        inlineData: {
          mimeType: 'image/png',
          data: fileBuffer.toString('base64'),
        },
      };
      console.log(`[AI Service] Loaded reference image for ${productType} from: ${imagePath}`);
    } else {
      console.warn(`[AI Service] Reference image for ${productType} not found at: ${imagePath}`);
    }
  } catch (err) {
    console.error(`[AI Service] Error loading reference image for ${productType}:`, err);
  }

  const inputPrompt = `Input JSON: ${JSON.stringify({
    productType,
    selectedAccessories,
    colorPreference: colorPreference || null,
    illustrationAllowed,
    rawPrompt: String(customPrompt || '').trim(),
  })}`;

  const systemInstruction = `You are an expert crochet artisan and design studio director. Your job is to translate the user's raw design requests, selected features, and custom parameters into a highly detailed, professional, and visually stunning English descriptive prompt for generating an image of a handmade crochet companion.

Return STRICT JSON only. No markdown, no extra text, no code fences.

Your output must be a single JSON object containing:
- subject: string (core subject description)
- mood: string (e.g. pastel, vibrant, dark, cozy)
- colorReferences: array of strings (extracted colors)
- styleKeywords: array of strings (crochet style descriptions)
- optimizedPrompt: string (a comprehensive English prompt for Imagen 4 focusing strictly on crochet art: 3D woolen stitches, soft organic cotton texture, cozy craft aesthetics, high-quality handmade details, soft studio lighting, clean solid pastel background. Avoid buzzwords like 'photorealistic', '4k', 'detailed').

GLOBAL RULES:
- Use ONLY details that are relevant to the selected options or allowed domains.
- Ignore noisy, unrelated, or contradictory phrases in rawPrompt.
- If a requested detail is not allowed, discard it completely (do not paraphrase it).
- optimizedPrompt must be detailed: 5-8 short sentences covering subject, shape/silhouette, stitch texture, color palette, allowed accessory details, lighting, background, composition.
- Analyze the attached reference image of the base product structure. Make sure your optimizedPrompt describes a crochet product of the same category, inheriting the overall crochet stitch style, proportions, and construction form shown in the reference image.

CASE RULES:
1) productType = "mini_figure"
- selectedAccessories lists the ONLY accessories you may describe.
- Describe ONLY those accessories. Never mention any unselected accessory or clothing.
- If selectedAccessories is empty, describe a simple base figure with no extra accessories.
- Extract and apply details (color, length, style, material, shape) ONLY for selected accessories.

2) productType = "bag" OR "hat"
- Always describe the correct product type in English (crochet bag or crochet hat).
- From rawPrompt, extract ONLY shape/silhouette cues. If none, choose a tasteful random shape.
- If illustrationAllowed is false, DO NOT include any pattern, print, logo, graphic, or illustration details. Use a plain, clean surface with stitch texture only.
- If illustrationAllowed is true, you may add a small, simple motif (tasteful, minimal).
- The user does not need to mention the words "bag" or "hat"; use shape-only guidance as input.
`;

  const apiKey = await getApiKey();

  console.log('API Key:', apiKey);

  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY is not defined. Using local prompt composer.');
    const filteredMiniFigurePrompt =
      productType === 'mini_figure' && selectedAccessories.length
        ? filterSentencesByKeywords(
            customPrompt,
            selectedAccessories.flatMap((key) => MINI_FIGURE_KEYWORDS[key] || [])
          )
        : '';
    const filteredBagHatPrompt =
      productType === 'bag' || productType === 'hat'
        ? illustrationAllowed
          ? String(customPrompt || '').trim()
          : removeSentencesByKeywords(customPrompt, BAG_HAT_PATTERN_KEYWORDS)
        : '';
    const baseSubject =
      productType === 'bag'
        ? 'crochet bag'
          : productType === 'hat'
        ? 'crochet hat'
        : 'crochet mini figure companion';
    const detailNote =
      productType === 'mini_figure' ? filteredMiniFigurePrompt : filteredBagHatPrompt;
    const accessoryNote =
      productType === 'mini_figure' && selectedAccessories.length
        ? `Selected accessories: ${selectedAccessories.join(', ')}.`
        : '';
    const surfaceNote =
      (productType === 'bag' || productType === 'hat') && !illustrationAllowed
        ? 'Plain surface with clean stitch texture.'
        : '';

    return {
      subject: baseSubject,
      mood: 'cozy and handmade',
      colorReferences: colorPreference ? [colorPreference] : ['pastel colors'],
      styleKeywords: ['crochet', 'wool', 'stitch', 'handcrafted'],
      optimizedPrompt: `A beautiful high-quality handcrafted ${baseSubject}. Cozy organic wool stitch texture. ${accessoryNote} ${
        detailNote ? `Details: ${detailNote}.` : ''
      } ${surfaceNote} Solid studio pastel background, soft warm lighting, 1:1 close-up shot.`,
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(referenceImagePart ? [referenceImagePart] : []),
              { text: inputPrompt }
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const resultJson = JSON.parse(data.candidates[0].content.parts[0].text);
    if (resultJson && resultJson.optimizedPrompt) {
      resultJson.optimizedPrompt = sanitizeOptimizedPrompt(
        resultJson.optimizedPrompt,
        productType,
        options
      );
    }
    console.log('[AI Service] Gemini prompt parsing result:', resultJson);
    return resultJson;
  } catch (error) {
    console.error('[AI Service] Gemini prompt parsing error:', error);
    // Graceful fallback
    const filteredMiniFigurePrompt =
      productType === 'mini_figure' && selectedAccessories.length
        ? filterSentencesByKeywords(
            customPrompt,
            selectedAccessories.flatMap((key) => MINI_FIGURE_KEYWORDS[key] || [])
          )
        : '';
    const filteredBagHatPrompt =
      productType === 'bag' || productType === 'hat'
        ? illustrationAllowed
          ? String(customPrompt || '').trim()
          : removeSentencesByKeywords(customPrompt, BAG_HAT_PATTERN_KEYWORDS)
        : '';
    const baseSubject =
      productType === 'bag'
        ? 'crochet bag'
        : productType === 'hat'
        ? 'crochet hat'
        : 'crochet mini figure companion';
    const detailNote =
      productType === 'mini_figure' ? filteredMiniFigurePrompt : filteredBagHatPrompt;
    const accessoryNote =
      productType === 'mini_figure' && selectedAccessories.length
        ? `Selected accessories: ${selectedAccessories.join(', ')}.`
        : '';
    const surfaceNote =
      (productType === 'bag' || productType === 'hat') && !illustrationAllowed
        ? 'Plain surface with clean stitch texture.'
        : '';
    return {
      subject: baseSubject,
      mood: 'cozy',
      colorReferences: colorPreference ? [colorPreference] : [],
      styleKeywords: ['crochet', 'handmade'],
      optimizedPrompt: `A beautiful high-quality handcrafted ${baseSubject}. Organic cotton wool stitch details. ${accessoryNote} ${
        detailNote ? `Customer details: ${detailNote}.` : ''
      } ${surfaceNote} Solid clean background, soft warm studio lighting, 1:1 crop.`,
    };
  }
};

/**
 * Generates a mockup preview image by calling Pollinations AI generator, or downloads a stunning mock placeholder
 * from Unsplash in local development mode, and uploads it to Supabase Storage.
 */
const generateMockup = async (optimizedPrompt, productType, designId) => {
  const filename = `${designId}_${Date.now()}.jpg`;

  try {
    console.log('[AI Service] Calling Pollinations AI generator...');
    const encodedPrompt = encodeURIComponent(
      optimizedPrompt + ', cute 3d crochet wool style, isolated solid white studio background'
    );
    const seed = Math.floor(Math.random() * 2147483647);
    const pollinationsUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=512&height=512&nologo=true&seed=${seed}`;

    const apiKey = await settingsService.getSetting('pollinations_api_key', process.env.POLLINATIONS_API_KEY);
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const imageResponse = await fetch(pollinationsUrl, { headers });
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      throw new Error(`Pollinations AI request failed with status ${imageResponse.status}: ${errorText}`);
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const { publicUrl } = await uploadFile('mockups', filename, buffer, 'image/jpeg');
    return publicUrl;
  } catch (pollinationsErr) {
    console.error(
      '[AI Service] Pollinations AI failed, falling back to static Unsplash mock:',
      pollinationsErr
    );

    // Failover fallback (static Unsplash)
    const fallbackUrl = MOCK_MOCKUP_IMAGES[productType] || MOCK_MOCKUP_IMAGES['mini_figure'];
    try {
      const imageResponse = await fetch(fallbackUrl);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const { publicUrl } = await uploadFile('mockups', filename, buffer, 'image/jpeg');
      return publicUrl;
    } catch (err) {
      return 'https://images.unsplash.com/photo-1608889175123-8ec330b86f84?auto=format&fit=crop&q=80&w=600&h=600';
    }
  }
};

module.exports = {
  parsePrompt,
  generateMockup,
};
