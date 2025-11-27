# Guía de Pruebas: JSDoc Swagger SmartFold

Este documento detalla los pasos para probar la extensión en desarrollo, instalarla localmente y ejecutar las pruebas automatizadas.

## 1. Prueba Rápida (Modo Desarrollo)

Esta es la forma más rápida de probar cambios mientras desarrollas.

### Pasos:
1.  Abre el proyecto en **VS Code**.
2.  Presiona `F5` (o ve a **Run and Debug** > **Run Extension**).
    *   Esto abrirá una nueva ventana llamada **[Extension Development Host]**.
3.  En esa nueva ventana, crea o abre un archivo JavaScript (`.js`) o TypeScript (`.ts`).
4.  Pega el siguiente código de ejemplo para verificar que el plegado y la validación funcionan:

```javascript
/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Test endpoint
 *     responses:
 *       200:
 *         description: Success
 */
function testHandler() {}

/**
 * @swagger
 * /api/error:
 *   get:
 *     summary: Endpoint with error
 *     description: Indentation error below intentionally
 *     responses:
 *       200:
 *      description: Bad indentation here
 */
function errorHandler() {}
```

### Qué verificar:
*   **Plegado**: El primer bloque `@swagger` debería plegarse automáticamente al abrir el archivo (si `swaggerFold.autoFold` está activado).
*   **Validación**: Deberías ver un error en la pestaña **Problems** (o subrayado en rojo) para el segundo bloque debido a la mala indentación en `description: Bad indentation here`.

---

## 2. Instalación Local (Uso en Proyectos Reales)

Para probar la extensión "en producción" o compartirla con compañeros sin publicar en el Marketplace.

### Prerrequisitos:
*   Tener instalada la herramienta `vsce` (Visual Studio Code Extensions CLI).
    ```bash
    npm install -g @vscode/vsce
    ```

### Pasos para empaquetar e instalar:
1.  En la terminal de la carpeta raíz del proyecto, ejecuta:
    ```bash
    npx vsce package
    ```
    *   Esto generará un archivo `.vsix` (ej. `jsdoc-swagger-smartfold-0.0.1.vsix`).

2.  Instala la extensión en tu VS Code principal:
    *   Abre la paleta de comandos (`Ctrl+Shift+P`).
    *   Escribe y selecciona: **Extensions: Install from VSIX...**
    *   Selecciona el archivo `.vsix` generado.

3.  Reinicia VS Code o recarga la ventana si es necesario. La extensión ahora estará activa en todos tus proyectos.

---

## 3. Pruebas Automatizadas

El proyecto incluye pruebas unitarias y de integración configuradas con Mocha y la API de pruebas de VS Code.

### Ejecutar pruebas:
1.  Asegúrate de que no haya instancias de VS Code bloqueando los archivos de prueba (opcional, pero recomendado).
2.  Ejecuta el siguiente comando en la terminal:
    ```bash
    npm test
    ```
    *   Este comando compilará el código (`npm run compile`), ejecutará el linter (`npm run lint`) y lanzará las pruebas.
    *   Se abrirá brevemente una instancia de VS Code para ejecutar los tests de integración.

### Ubicación de los tests:
*   Los archivos de prueba se encuentran en la carpeta `src/test/`.
*   `suite/extension.test.ts`: Contiene las pruebas principales de la extensión.

