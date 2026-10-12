const IMAGE_COLOR_MODELS = new Set(['RGB', 'Gray']);
const IMAGE_COLOR_PROFILES = new Set(['sRGB', 'Display P3']);
const AUDIO_KINDS = new Set(['WAVE', 'AIFF', 'AIFF-C']);

function validDimensions(value) {
  return Number.isSafeInteger(value?.width) && value.width > 0
    && Number.isSafeInteger(value?.height) && value.height > 0;
}

function formatSize(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return '未知';
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDimensions(dimensions) {
  return `${dimensions.width}\u200a×\u200a${dimensions.height} 像素`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '未知';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${Math.floor(total / 60)}:${String(remainder).padStart(2, '0')}`;
}

function add(rows, label, value) {
  if (typeof value === 'string' && value.length > 0) rows.push({ label, value });
}

/** Build safe, localized label/value rows from the scalar folder-preview result. */
export function buildFolderPreviewAttributes(result = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) result = {};
  const rows = [{ label: '大小', value: formatSize(result.size) }];

  if (result.executable === true) {
    add(rows, '类型', 'UNIX 可执行文件');
    add(rows, '预览', '不作纯文本预览');
    return rows;
  }
  if (result.binaryPropertyList === true) {
    add(rows, '类型', '二进制 Property List');
    add(rows, '预览', '不作纯文本预览');
    return rows;
  }

  if (result.audio === true) {
    const kind = AUDIO_KINDS.has(result.audioKind) ? result.audioKind : '未知格式';
    add(rows, '类型', `${kind} 音频`);
    add(rows, '时长', formatDuration(result.audioDurationSeconds));
    return rows;
  }

  if (result.isoBmff === true) {
    const movie = result.movie === true;
    add(rows, '类型', movie ? 'ISO BMFF 视频' : 'ISO BMFF 媒体容器');
    if (movie && validDimensions(result.movieDimensions)) add(rows, '尺寸', formatDimensions(result.movieDimensions));
    if (movie) add(rows, '时长', formatDuration(result.movieDurationSeconds));
    else add(rows, '预览', '受限范围内未确认视频轨道');
    return rows;
  }

  const image = result.image === true && validDimensions(result.imageDimensions);
  if (image) {
    add(rows, '类型', '图像');
    add(rows, '尺寸', formatDimensions(result.imageDimensions));
    if (Number.isFinite(result.imageDpi) && result.imageDpi > 0) {
      const dpi = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(result.imageDpi);
      add(rows, '水平 DPI', `${dpi} 像素/英寸`);
    }
    if (IMAGE_COLOR_MODELS.has(result.imageColorModel)) add(rows, '色彩模型', result.imageColorModel);
    if (IMAGE_COLOR_PROFILES.has(result.imageColorProfile)) add(rows, '色彩配置文件', result.imageColorProfile);
    return rows;
  }

  if (typeof result.encoding === 'string' && result.encoding.length > 0) {
    if (result.image !== true) add(rows, '类型', '文本');
    add(rows, '编码', result.encoding);
  }
  if (result.truncated === true) add(rows, '预览', '已截断');
  return rows;
}
