import { dominantLineEnding, getLineEndings } from './text-tools.js';
import { languageForMappedFilename } from './syntax-mapping-conflicts.js';

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

export function countCharacters(text = '') {
  const value = String(text);
  return graphemeSegmenter ? [...graphemeSegmenter.segment(value)].length : [...value].length;
}

export const LANGUAGE_OPTIONS = [
  { id: 'plaintext', label: '纯文本', extensions: ['txt', 'text', 'log'] },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'pac'] },
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'tsx', 'mts', 'cts'] },
  { id: 'jsx', label: 'JSX', extensions: ['jsx'] },
  { id: 'json', label: 'JSON', extensions: ['geojson', 'json', 'jsonc', 'jsonl'], filenames: ['Package.resolved'] },
  { id: 'html', label: 'HTML', extensions: ['html', 'htm', 'shtml'] },
  { id: 'css', label: 'CSS', extensions: ['css', 'scss', 'less'] },
  { id: 'markdown', label: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'mkd', 'mdown', 'mkdn'] },
  { id: 'python', label: 'Python', extensions: ['py', 'pyw', 'pyi'], interpreters: ['python', 'python2', 'python3'] },
  { id: 'java', label: 'Java', extensions: ['java', 'jav'] },
  { id: 'cpp', label: 'C / C++', extensions: ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'c++', 'cp', 'hp', 'hxx', 'h++', 'ipp', 'cu', 'cuh'] },
  { id: 'csharp', label: 'C#', extensions: ['cs'], interpreters: ['csharp'] },
  { id: 'objectivec', label: 'Objective-C', extensions: ['m', 'mm'] },
  { id: 'rust', label: 'Rust', extensions: ['rs', 'rc'], interpreters: ['rustx'] },
  { id: 'php', label: 'PHP', extensions: ['php', 'php3', 'php4', 'php5', 'phps', 'phtml'], interpreters: ['php'] },
  { id: 'go', label: 'Go', extensions: ['go'] },
  { id: 'ruby', label: 'Ruby', extensions: ['rb', 'rake', 'erb'], filenames: ['Gemfile'], interpreters: ['ruby'] },
  { id: 'swift', label: 'Swift', extensions: ['swift', 'swiftinterface'], interpreters: ['swift'] },
  { id: 'kotlin', label: 'Kotlin', extensions: ['kt', 'kts'], interpreters: ['kotlin', 'kotlinc'] },
  { id: 'scala', label: 'Scala', extensions: ['scala', 'sc'], interpreters: ['scala'] },
  { id: 'dart', label: 'Dart', extensions: ['dart'], interpreters: ['dart'] },
  { id: 'shell', label: 'Shell', extensions: ['sh', 'bash', 'zsh', 'command'], filenames: ['.profile', '.bash_login', '.bash_logout', '.bash_profile', '.bashrc', '.zlogin', '.zprofile', '.zshrc', '.zshenv'], interpreters: ['sh', 'bash', 'csh', 'ksh', 'tcsh', 'zsh'] },
  { id: 'powershell', label: 'PowerShell', extensions: ['ps1', 'psm1'], interpreters: ['pwsh'] },
  { id: 'perl', label: 'Perl', extensions: ['pl', 'pm', 'cgi'], interpreters: ['perl'] },
  { id: 'lua', label: 'Lua', extensions: ['lua'], interpreters: ['lua', 'luajit'] },
  { id: 'r', label: 'R', extensions: ['r'], filenames: ['.Rprofile'], interpreters: ['Rscript'] },
  { id: 'clojure', label: 'Clojure', extensions: ['clj', 'cljs', 'cljc', 'edn'] },
  { id: 'haskell', label: 'Haskell', extensions: ['hs', 'lhs'], interpreters: ['runhaskell'] },
  { id: 'groovy', label: 'Groovy', extensions: ['groovy', 'gradle'] },
  { id: 'julia', label: 'Julia', extensions: ['jl'], interpreters: ['julia'] },
  { id: 'erlang', label: 'Erlang', extensions: ['erl', 'hrl'] },
  { id: 'fsharp', label: 'F#', extensions: ['fs', 'fsx'] },
  { id: 'ocaml', label: 'OCaml', extensions: ['ml', 'mli'] },
  { id: 'sml', label: 'Standard ML', extensions: ['sml'] },
  { id: 'fortran', label: 'Fortran', extensions: ['f', 'for', 'f90', 'f95', 'f03', 'f08', 'cuf'] },
  { id: 'coffeescript', label: 'CoffeeScript', extensions: ['coffee'], interpreters: ['coffee'] },
  { id: 'dockerfile', label: 'Dockerfile', extensions: ['dockerfile'], filenames: ['Dockerfile'] },
  { id: 'toml', label: 'TOML', extensions: ['toml'] },
  { id: 'properties', label: 'INI / Properties', extensions: ['ini', 'properties', 'cfg', 'url'], filenames: ['.editorconfig', '.gitconfig', '.gitmodules', 'gitconfig'] },
  { id: 'diff', label: 'Diff / Patch', extensions: ['diff', 'patch', 'dif'] },
  { id: 'protobuf', label: 'Protocol Buffers', extensions: ['proto'], interpreters: ['protoc'] },
  { id: 'cmake', label: 'CMake', extensions: ['cmake'], filenames: ['CMakeLists.txt'] },
  { id: 'nginx', label: 'Nginx', extensions: ['nginx'] },
  { id: 'verilog', label: 'Verilog', extensions: ['v', 'sv'] },
  { id: 'vhdl', label: 'VHDL', extensions: ['vhd', 'vhdl'] },
  { id: 'vb', label: 'Visual Basic', extensions: ['vb'] },
  { id: 'd', label: 'D', extensions: ['d'], interpreters: ['rdmd'] },
  { id: 'factor', label: 'Factor', extensions: ['factor'] },
  { id: 'scheme', label: 'Scheme', extensions: ['scm', 'ss'], interpreters: ['chicken-scheme', 'csi', 'gosh', 'guile', 'gsi'] },
  { id: 'pascal', label: 'Pascal', extensions: ['pas', 'pp'] },
  { id: 'cobol', label: 'COBOL', extensions: ['cob', 'cbl'] },
  { id: 'commonlisp', label: 'Common Lisp', extensions: ['lisp', 'lsp', 'cl'], interpreters: ['sbcl'] },
  { id: 'crystal', label: 'Crystal', extensions: ['cr'] },
  { id: 'cypher', label: 'Cypher', extensions: ['cql'] },
  { id: 'eiffel', label: 'Eiffel', extensions: ['e'] },
  { id: 'elm', label: 'Elm', extensions: ['elm'] },
  { id: 'gherkin', label: 'Gherkin', extensions: ['feature'] },
  { id: 'haxe', label: 'Haxe', extensions: ['hx'] },
  { id: 'livescript', label: 'LiveScript', extensions: ['ls'] },
  { id: 'sas', label: 'SAS', extensions: ['sas'] },
  { id: 'smalltalk', label: 'Smalltalk', extensions: ['st'] },
  { id: 'sparql', label: 'SPARQL', extensions: ['rq'] },
  { id: 'tcl', label: 'Tcl', extensions: ['tcl'], interpreters: ['jimsh', 'tclsh', 'wish'] },
  { id: 'webidl', label: 'WebIDL', extensions: ['webidl'] },
  { id: 'xquery', label: 'XQuery', extensions: ['xq', 'xquery'] },
  { id: 'turtle', label: 'Turtle', extensions: ['ttl'] },
  { id: 'pug', label: 'Pug', extensions: ['pug'] },
  { id: 'vbscript', label: 'VBScript', extensions: ['vbs'] },
  { id: 'z80', label: 'Z80 Assembly', extensions: ['z80'] },
  { id: 'sql', label: 'SQL', extensions: ['sql', 'mysql', 'pgsql'] },
  { id: 'xml', label: 'XML', extensions: ['xml', 'xsl', 'xslt', 'xsd', 'rlx', 'rdf', 'svg'] },
  { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'] }
];

export function languageForFilename(filename = '', customSyntaxes = [], content = '') {
  return languageForMappedFilename(filename, customSyntaxes, LANGUAGE_OPTIONS, content);
}

export function getTextStats(text = '') {
  const value = String(text);
  const lineEndings = getLineEndings(value);
  const lines = value.length ? lineEndings.length + 1 : 1;
  const words = value.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
  return {
    characters: countCharacters(value),
    words,
    lines,
    eol: dominantLineEnding(lineEndings, 'LF')
  };
}

export function isDirty(document) {
  return document.text !== document.savedText
    || (document.savedEncoding != null && document.encoding !== document.savedEncoding)
    || (document.savedEol != null && document.eol !== document.savedEol)
    || (document.savedLineEndings != null && JSON.stringify(document.lineEndings || []) !== JSON.stringify(document.savedLineEndings))
    || (document.savedBom != null && document.bom !== document.savedBom);
}

export function selectRecoverableDrafts(value) {
  return Array.isArray(value)
    ? value.filter(item => item && typeof item.text === 'string').slice(0, 20)
    : [];
}
