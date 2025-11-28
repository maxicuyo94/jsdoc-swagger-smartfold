#!/usr/bin / env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Script de Release Automatizado
 *
 * Este script automatiza el proceso de publicación dual:
 * - Visual Studio Marketplace (vsce)
 * - Open VSX (ovsx)
 *
 * Uso:
 *   node scripts/release.js [--dry-run] [--skip-vs] [--skip-ovsx]
 *
 * Opciones:
 *   --dry-run    Solo empaqueta, no publica
 *   --skip-vs    Omitir publicación en VS Marketplace
 *   --skip-ovsx  Omitir publicación en Open VSX
 *
 * Variables de entorno requeridas:
 *   VSCE_PAT     - Personal Access Token para VS Marketplace
 *   OPENVSX_TOKEN - Token para Open VSX
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, colors.cyan);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

function getPackageInfo() {
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('No se encontró package.json en el directorio actual');
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    skipVS: args.includes('--skip-vs'),
    skipOVSX: args.includes('--skip-ovsx'),
  };
}

function checkEnvironment(options) {
  const issues = [];

  if (!options.skipVS && !options.dryRun) {
    if (!process.env.VSCE_PAT) {
      issues.push('VSCE_PAT no está definido (requerido para VS Marketplace)');
    }
  }

  if (!options.skipOVSX && !options.dryRun) {
    if (!process.env.OPENVSX_TOKEN) {
      issues.push('OPENVSX_TOKEN no está definido (requerido para Open VSX)');
    }
  }

  return issues;
}

async function main() {
  log('\n========================================', colors.bright);
  log('  JSDoc Swagger SmartFold - Release', colors.bright);
  log('========================================\n', colors.bright);

  const options = parseArgs();

  if (options.dryRun) {
    logWarning('Modo DRY-RUN: Solo se empaquetará, no se publicará');
  }

  // Paso 1: Leer información del paquete
  logStep('1/6', 'Leyendo información del paquete...');
  let packageInfo;
  try {
    packageInfo = getPackageInfo();
    logSuccess(`Nombre: ${packageInfo.name}`);
    logSuccess(`Versión: ${packageInfo.version}`);
    logSuccess(`Publisher: ${packageInfo.publisher}`);
  } catch (error) {
    logError(`Error leyendo package.json: ${error.message}`);
    process.exit(1);
  }

  // Paso 2: Verificar entorno
  logStep('2/6', 'Verificando entorno...');
  const envIssues = checkEnvironment(options);
  if (envIssues.length > 0) {
    envIssues.forEach((issue) => logError(issue));
    if (!options.dryRun) {
      log('\nConfigura las variables de entorno necesarias:', colors.yellow);
      log('  export VSCE_PAT="tu-token-azure"', colors.yellow);
      log('  export OPENVSX_TOKEN="tu-token-openvsx"', colors.yellow);
      process.exit(1);
    }
  } else {
    logSuccess('Variables de entorno configuradas correctamente');
  }

  // Paso 3: Verificar paquete con vsce ls
  logStep('3/6', 'Verificando contenido del paquete...');
  const lsResult = exec('npx vsce ls', { silent: true });
  if (!lsResult.success) {
    logError('Error verificando el paquete');
    logError(lsResult.error);
    process.exit(1);
  }
  const fileCount = lsResult.output.trim().split('\n').length;
  logSuccess(`El paquete contiene ${fileCount} archivos`);

  // Paso 4: Empaquetar
  logStep('4/6', 'Generando archivo .vsix...');
  const vsixName = `${packageInfo.name}-${packageInfo.version}.vsix`;
  const packageResult = exec('npx vsce package');
  if (!packageResult.success) {
    logError('Error empaquetando la extensión');
    process.exit(1);
  }

  if (fs.existsSync(vsixName)) {
    const stats = fs.statSync(vsixName);
    const sizeKB = (stats.size / 1024).toFixed(2);
    logSuccess(`Generado: ${vsixName} (${sizeKB} KB)`);
  } else {
    logError(`No se encontró el archivo ${vsixName}`);
    process.exit(1);
  }

  if (options.dryRun) {
    log('\n========================================', colors.bright);
    log('  DRY-RUN completado exitosamente', colors.green);
    log('========================================\n', colors.bright);
    process.exit(0);
  }

  // Paso 5: Publicar en VS Marketplace
  if (!options.skipVS) {
    logStep('5/6', 'Publicando en Visual Studio Marketplace...');
    const vsResult = exec(`npx vsce publish -p ${process.env.VSCE_PAT}`);
    if (!vsResult.success) {
      logError('Error publicando en VS Marketplace');
      logWarning('Continuando con Open VSX...');
    } else {
      logSuccess('Publicado en Visual Studio Marketplace');
    }
  } else {
    logStep('5/6', 'Omitiendo Visual Studio Marketplace (--skip-vs)');
  }

  // Paso 6: Publicar en Open VSX
  if (!options.skipOVSX) {
    logStep('6/6', 'Publicando en Open VSX...');
    const ovsxResult = exec(`npx ovsx publish ${vsixName} -p ${process.env.OPENVSX_TOKEN}`);
    if (!ovsxResult.success) {
      logError('Error publicando en Open VSX');
    } else {
      logSuccess('Publicado en Open VSX');
    }
  } else {
    logStep('6/6', 'Omitiendo Open VSX (--skip-ovsx)');
  }

  // Resumen final
  log('\n========================================', colors.bright);
  log('  Release completado', colors.green);
  log('========================================', colors.bright);
  log(`\nVersión ${packageInfo.version} publicada.`, colors.green);
  log('\nEnlaces:', colors.cyan);
  log(
    `  VS Marketplace: https://marketplace.visualstudio.com/items?itemName=${packageInfo.publisher}.${packageInfo.name}`,
  );
  log(`  Open VSX: https://open-vsx.org/extension/${packageInfo.publisher}/${packageInfo.name}`);
  log('');
}

main().catch((error) => {
  logError(`Error fatal: ${error.message}`);
  process.exit(1);
});
