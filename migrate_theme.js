const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, 'frontend');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.expo' && f !== 'constants') {
        walk(dirPath, callback);
      }
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

function getRelativePath(from, to) {
  let rel = path.relative(path.dirname(from), to).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\.tsx?$/, '');
}

function insertIntoComponent(content, componentName) {
  // Try to find the component definition
  const regexes = [
    new RegExp(`(export\\s+default\\s+function\\s+${componentName}\\s*\\([^)]*\\)\\s*\\{)`),
    new RegExp(`(export\\s+function\\s+${componentName}\\s*\\([^)]*\\)\\s*\\{)`),
    new RegExp(`(const\\s+${componentName}\\s*=\s*\\([^)]*\\)\\s*=>\\s*\\{)`),
    new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\)\\s*\\{)`)
  ];

  for (let regex of regexes) {
    if (regex.test(content)) {
      return content.replace(regex, `$1\n  const { theme, isDark } = useTheme();\n  const styles = getStyles(theme);\n`);
    }
  }

  // Fallback: look for generic default export
  if (content.includes('export default function')) {
    return content.replace(/(export\s+default\s+function[^{]*\{)/, `$1\n  const { theme, isDark } = useTheme();\n  const styles = getStyles(theme);\n`);
  }
  return content;
}

function replaceStyles(content) {
  if (content.includes('const styles = StyleSheet.create({')) {
    let replaced = content.replace(/const\s+styles\s*=\s*StyleSheet\.create\s*\(\{/g, 'const getStyles = (theme: any) => StyleSheet.create({');
    return replaced;
  }
  return content;
}

walk(FRONTEND_DIR, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip files that don't import theme from constants directly
  if (!content.includes('from \'../constants/theme\'') && 
      !content.includes('from \'../../constants/theme\'') &&
      !content.includes('from \'../../../constants/theme\'')) {
    return;
  }

  // Avoid files already using useTheme heavily
  if (content.includes('const { theme') && content.includes('useTheme(')) {
    return;
  }

  console.log(`Migrating ${filePath}`);

  const themeContextPath = path.join(FRONTEND_DIR, 'context', 'ThemeContext');
  const relativeThemeContextPath = getRelativePath(filePath, themeContextPath);
  
  content = content.replace(/import\s*\{\s*theme\s*\}\s*from\s*['"][^'"]+constants\/theme['"];?/g, 
    `import { useTheme } from '${relativeThemeContextPath}';`);

  content = replaceStyles(content);

  // Extract component name from filename (naive approach, handles index.tsx as well by looking at export default)
  let componentName = path.basename(filePath, path.extname(filePath));
  // If component is index, it might be exported as default function
  content = insertIntoComponent(content, componentName);

  fs.writeFileSync(filePath, content, 'utf8');
});
