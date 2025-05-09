---
mapped_pages:
  - https://www.elastic.co/guide/en/kibana/current/monorepo-packages.html
---

# Kibana monorepo packages [monorepo-packages]

Currently {{kib}} works as a monorepo composed by a core, plugins and packages. The latest are located in a folder called `packages` and are pieces of software that composes a set of features that can be isolated and reused across the entire repository. They are also supposed to be able to imported just like any other `node_module`.

Previously we relied solely on `@kbn/pm` to manage the development tools of those packages, but we are now in the middle of migrating those responsibilities into Bazel. Every package already migrated will contain in its root folder a `BUILD.bazel` file and other `build` and `watching` strategies should be used.

Remember that any time you need to make sure the monorepo is ready to be used just run:

```bash
yarn kbn bootstrap
```


## Building bazel packages [_building_bazel_packages]

Bazel packages are built as a whole for now. You can use:

```bash
yarn kbn bootstrap
```


## Watching bazel packages [_watching_bazel_packages]

Bazel packages are watched as a whole for now. You can use:

```bash
yarn kbn watch
```


## List of already migrated packages to bazel [_list_of_already_migrated_packages_to_bazel]

* @kbn/analytics
* @kbn/apm-config-loader
* @kbn/apm-utils
* @kbn/babel-preset
* @kbn/cli-dev-mode
* @kbn/config
* @kbn/config-schema
* @kbn/crypto
* @kbn/datemath
* @kbn/dev-utils
* @kbn/docs-utils
* @kbn/es
* @kbn/es-archiver
* @kbn/eslint-config-kibana
* @kbn/eslint-plugin-eslint
* @kbn/expect
* @kbn/i18n
* @kbn/interpreter
* @kbn/io-ts-utils
* @kbn/logging
* @kbn/mapbox-gl
* @kbn/monaco
* @kbn/optimizer
* @kbn/plugin-helpers
* @kbn/rule-data-utils
* @kbn/safer-lodash-set
* @kbn/securitysolution-autocomplete
* @kbn/securitysolution-es-utils
* @kbn/securitysolution-hook-utils
* @kbn/securitysolution-io-ts-alerting-types
* @kbn/securitysolution-io-ts-list-types
* @kbn/securitysolution-io-ts-types
* @kbn/securitysolution-io-ts-utils
* @kbn/securitysolution-list-api
* @kbn/securitysolution-list-constants
* @kbn/securitysolution-list-hooks
* @kbn/securitysolution-list-utils
* @kbn/securitysolution-rules
* @kbn/securitysolution-utils
* @kbn/server-http-tools
* @kbn/server-route-repository
* @kbn/std
* @kbn/storybook
* @kbn/telemetry-utils
* @kbn/test
* @kbn/test-subj-selector
* @kbn/tinymath
* @kbn/ui-shared-deps-npm
* @kbn/ui-shared-deps-src
* @kbn/utility-types
* @kbn/utils

