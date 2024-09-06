import path from 'path';
import fs from 'fs';

import { getOptions, interpolateName } from 'loader-utils';
import { validate } from 'schema-utils';

import schema from './options.json';
import { normalizePath } from './utils';

export default function loader(content) {
  const options = getOptions(this);

  validate(schema, options, {
    name: 'File Loader',
    baseDataPath: 'options',
  });

  const context = options.context || this.rootContext;
  const name = options.name || '[contenthash].[ext]';

  const url = interpolateName(this, name, {
    context,
    content,
    regExp: options.regExp,
  });

  let outputPath = url;

  if (options.outputPath) {
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  function transf(inputPath) {
    let resultPath = `__webpack_public_path__ + ${JSON.stringify(inputPath)}`;

    if (options.publicPath) {
      if (typeof options.publicPath === 'function') {
        resultPath = options.publicPath(url, this.resourcePath, context);
      } else {
        resultPath = `${
          options.publicPath.endsWith('/')
            ? options.publicPath
            : `${options.publicPath}/`
        }${url}`;
      }

      resultPath = JSON.stringify(resultPath);
    }

    if (options.postTransformPublicPath) {
      resultPath = options.postTransformPublicPath(resultPath);
    }

    return resultPath;
  }

  const publicPath = transf(outputPath);

  let optionalDark = null;

  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    const assetInfo = {};
    const darkAssetInfo = {};

    if (typeof name === 'string') {
      let normalizedName = name;

      const idx = normalizedName.indexOf('?');

      if (idx >= 0) {
        normalizedName = normalizedName.substr(0, idx);
      }

      const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(
        normalizedName,
      );

      if (isImmutable === true) {
        assetInfo.immutable = true;
        darkAssetInfo.immutable = true;
      }
    }

    assetInfo.sourceFilename = normalizePath(
      path.relative(this.rootContext, this.resourcePath),
    );

    const extension = path.extname(assetInfo.sourceFilename);
    const darkImage = path.join(
      path.dirname(assetInfo.sourceFilename),
      `${path.basename(assetInfo.sourceFilename, extension)}_dark${extension}`,
    );

    darkAssetInfo.sourceFilename = darkImage;

    if (fs.existsSync(darkImage)) {
      console.log('darkImage EXISTS', darkImage, publicPath);

      const extension = path.extname(outputPath);
      const darkOutputPath = path.join(
        path.dirname(outputPath),
        `${path.basename(outputPath, extension)}_dark${extension}`,
      );
      const darkString = transf(darkOutputPath);

      optionalDark = `dark: ${darkString}`;
      console.log('optionalDark', optionalDark);
      this.emitFile(
        darkOutputPath,
        fs.readFileSync(darkImage),
        null,
        darkAssetInfo,
      );
    }

    console.log('emitted', outputPath);

    this.emitFile(outputPath, content, null, assetInfo);
  } else {
    console.log('NOT emitted', outputPath, options);
  }

  const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : true;

  if (optionalDark === null) {
    return `${esModule ? 'export default' : 'module.exports ='} ${publicPath};`;
    /* return `${
      esModule ? 'export default' : 'module.exports ='
    } { light:${publicPath}};`; */
  }

  return `${
    esModule ? 'export default' : 'module.exports ='
  } { light:${publicPath}, ${optionalDark}};`;
}

export const raw = true;
