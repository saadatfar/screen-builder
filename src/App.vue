<template>
  <b-container class="h-100" id="screen-builder-container">
    <b-card no-body class="h-100 bg-white border-top-0" id="app">
      <!-- Card Header -->
      <b-card-header>
        <b-row>
          <b-col>
            <b-button-group size="sm">
              <b-button :variant="displayBuilder? 'secondary' : 'outline-secondary'" @click="mode = 'editor'" data-cy="mode-editor">
                <i class="fas fa-drafting-compass pr-1"/>{{ $t('Design') }}
              </b-button>
              <b-button :variant="!displayBuilder? 'secondary' : 'outline-secondary'" @click="mode = 'preview'" data-cy="mode-preview">
                <i class="fas fa-cogs pr-1"/>{{ $t('Preview') }}
              </b-button>
            </b-button-group>
          </b-col>

          <b-col class="text-right" v-if="displayBuilder && !displayPreview">
            <div class="btn-group btn-group-sm mr-2" role="group" aria-label="Basic example">
              <button type="button" class="btn btn-secondary" :title="$t('Calculated Properties')" @click="openComputedProperties">
                <i class="fas fa-flask"/>
                {{ $t('Calcs') }}
              </button>
              <button type="button" class="btn btn-secondary" :title="$t('Custom CSS')" @click="openCustomCSS">
                <i class="fab fa-css3"/>
                {{ $t('CSS') }}
              </button>
              <button type="button" class="btn btn-secondary" :title="$t('Watchers')" @click="openWatchersPopup">
                <i class="fas fa-mask"/>
                {{ $t('Watchers') }}
              </button>
            </div>
            <b-btn variant="secondary" size="sm" v-b-modal="'uploadmodal'" class="mr-2" :title="$t('Load Screen')">
              <i class="fas fa-upload mr-1"/>
            </b-btn>
            <button v-b-modal.preview-config type="button" @click="saveToLocalStorage()" class="btn btn-secondary btn-sm ml-1" :title="$t('Save Screen')"><i class="fas fa-save"/></button>
          </b-col>
          <b-modal
            ref="uploadmodal"
            id="uploadmodal"
            :title="$t('Upload JSON File')"
            :cancel-title="$t('Cancel')"
            :ok-title="$t('Upload')"
            :ok-disabled="!uploadedJson"
            cancel-variant="outline-secondary"
            ok-variant="secondary"
            @hidden="this.clearUpload"
            @ok="loadScreenPackage"
          >
            <file-upload class="btn btn-primary" v-model="jsonFiles">
              {{ $t('Select file') }}
            </file-upload>

            <span class="ml-3" v-if="jsonFiles[0]">{{ jsonFiles[0].name }}</span>
          </b-modal>
        </b-row>
      </b-card-header>

      <!-- Card Body -->
      <b-card-body class="overflow-auto p-0 m-0">
        <!-- Vue-form-builder -->
        <vue-form-builder :validationErrors="validationErrors" ref="builder" @change="updateConfig" :class="displayBuilder ? 'd-flex' : 'd-none'" :screen="screen" />

        <!-- Preview -->
        <b-row class="h-100 m-0" id="preview" v-show="displayPreview" data-cy="preview">
          <b-col class="overflow-auto h-100">
            <vue-form-renderer ref="renderer"
              v-model="previewData"
              @submit="previewSubmit"
              :config="config"
              :mode="mode"
              :computed="computed"
              :custom-css="customCSS"
              v-on:css-errors="cssErrors = $event"
            />
          </b-col>

          <b-col class="overflow-hidden h-100 preview-inspector p-0">
            <b-card no-body class="p-0 h-100 rounded-0 border-top-0 border-right-0 border-bottom-0">
              <b-card-body class="p-0 overflow-auto">
                <b-button variant="outline"
                  class="text-left card-header d-flex align-items-center w-100 shadow-none"
                  @click="showDataInput = !showDataInput"
                >
                  <i class="fas fa-file-import mr-2"/>
                  {{ $t('Data Input') }}
                  <i class="fas ml-auto" :class="showDataInput ? 'fa-angle-down' : 'fa-angle-right'"/>
                </b-button>

                <b-collapse v-model="showDataInput" id="showDataInput">
                  <monaco-editor :options="monacoOptions" class="data-collapse" v-model="previewInput" language="json"/>
                </b-collapse>

                <b-button variant="outline"
                  class="text-left card-header d-flex align-items-center w-100 shadow-none"
                  data-toggle="collapse"
                  @click="showDataPreview = !showDataPreview"
                >
                  <i class="fas fa-file-code mr-2"/>
                  {{ $t('Data Preview') }}
                  <i class="fas ml-auto" :class="showDataPreview ? 'fa-angle-down' : 'fa-angle-right'"/>
                </b-button>

                <b-collapse v-model="showDataPreview" id="showDataPreview" data-cy="preview-data-content" class="mt-2">
                  <vue-json-pretty :data="previewData" class="p-2 data-collapse"/>
                </b-collapse>

              </b-card-body>
            </b-card>
          </b-col>
        </b-row>

      </b-card-body>

      <!-- Card Footer -->
      <b-card-footer class="d-flex d-flex justify-content-end align-items-center">
        <b-form-checkbox v-model="toggleValidation" name="check-button" switch>
          {{ $t('Screen Validation') }}
        </b-form-checkbox>

        <div class="ml-3" @click="showValidationErrors = !showValidationErrors">
          <button type="button" class="btn btn-light btn-sm">
            <i class="fas fa-angle-double-up"/>
            {{ $t('Open Console') }}
            <span v-if="allErrors === 0" class="badge badge-success">
              <i class="fas fa-check-circle "/>
              {{ $t(allErrors) }}
            </span>

            <span v-else class="badge badge-danger">
              <i class="fas fa-times-circle "/>
              {{ $t(allErrors) }}
            </span>
          </button>
        </div>

        <div v-if="showValidationErrors" class="validation-panel position-absolute border-left border-top overflow-auto" :class="{'d-block':showValidationErrors && validationErrors.length}">
          <div v-if="!previewInputValid" class="p-3 font-weight-bold text-dark">
            <i class="fas fa-times-circle text-danger mr-3"/>
            {{ $t('Invalid JSON Data Object') }}
          </div>
          <b-button variant="link" class="validation__message d-flex align-items-center p-3"
            v-for="(validation,index) in validationErrors"
            :key="index"
            @click="focusInspector(validation)"
          >
            <i class="fas fa-times-circle text-danger d-block mr-3"/>
            <span class="ml-2 text-dark font-weight-bold text-left">
              {{ validation.item.component }}
              <span class="d-block font-weight-normal">{{ validation.message }}</span>
            </span>
          </b-button>
          <span v-if="!allErrors" class="d-flex justify-content-center align-items-center h-100">{{ $t('No Errors') }}</span>
        </div>
      </b-card-footer>
    </b-card>
    <!-- Modals -->
    <computed-properties v-model="computed" ref="computedProperties"/>
    <custom-CSS v-model="customCSS" ref="customCSS" :cssErrors="cssErrors"/>
    <watchers-popup v-model="watchers" ref="watchersPopup"/>
    <b-modal id="preview-config" size="xl" title="Screen Config JSON Preview">
      <monaco-editor @editorDidMount="editorDidMount" style="height: 500px" :options="monacoOptions" v-model="previewConfig" language="json"></monaco-editor>
    </b-modal>
  </b-container>
</template>

<script>
import ComputedProperties from './components/computed-properties.vue';
import WatchersPopup from './components/watchers-popup.vue';
import CustomCSS from './components/custom-css.vue';
import VueFormBuilder from './components/vue-form-builder.vue';
import VueFormRenderer from './components/vue-form-renderer.vue';
import VueJsonPretty from 'vue-json-pretty';
import MonacoEditor from 'vue-monaco';
import canOpenJsonFile from './mixins/canOpenJsonFile';

// Bring in our initial set of controls
import controlConfig from './form-builder-controls';
import globalProperties from './global-properties';

import Validator from 'validatorjs';

// To include another language in the Validator with variable processmaker
let globalObject = typeof window === 'undefined'
  ? global
  : window;

if (globalObject.ProcessMaker && globalObject.ProcessMaker.user && globalObject.ProcessMaker.user.lang) {
  Validator.useLang(globalObject.ProcessMaker.user.lang);
}

Validator.register('attr-value', value => {
  return value.match(/^[a-zA-Z0-9-_]+$/);
}, 'Must be letters, numbers, underscores or dashes');

export default {
  name: 'app',
  mixins: [canOpenJsonFile],
  data() {
    return {
      screen: {
        id: 1,
      },
      watchers_config: {
        api: {
          scripts: [],
          execute: null,
        },
      },
      mode: 'editor',
      // Computed properties
      computed: [],
      // Watchers
      watchers: [],
      config: [
        {
          name: 'Default',
          computed: [],
          items: [],
        },
      ],
      previewData: {},
      previewInput: '{}',
      customCSS: '',
      cssErrors: '',
      showValidationErrors: false,
      toggleValidation: true,
      showDataPreview: true,
      showDataInput: true,
      monacoOptions: {
        automaticLayout: true,
        lineNumbers: 'off',
        minimap: false,
      },
    };
  },
  components: {
    ComputedProperties,
    CustomCSS,
    VueFormBuilder,
    VueFormRenderer,
    VueJsonPretty,
    MonacoEditor,
    WatchersPopup,
  },
  watch: {
    mode(mode) {
      if (mode === 'preview') {
        this.previewData = this.previewInput ? JSON.parse(this.previewInput) : null;
      }
    },
    config() {
      // Reset the preview data with clean object to start
      this.previewData = {};
    },
    previewInput() {
      if (this.previewInputValid) {
        // Copy data over
        this.previewData = JSON.parse(this.previewInput);
      } else {
        this.previewData = {};
      }
    },
  },
  computed: {
    previewInputValid() {
      try {
        JSON.parse(this.previewInput);
        return true;
      } catch (err) {
        return false;
      }
    },
    previewConfig: {
      get() {
        return JSON.stringify(this.config);
      },
      set(val) {
      }
    },
    displayBuilder() {
      return this.mode === 'editor';
    },
    displayPreview() {
      return this.mode === 'preview';
    },
    allErrors() {
      let errorCount = 0;

      if (!this.previewInputValid) {
        errorCount++;
      }

      return this.validationErrors.length + errorCount;
    },
    validationErrors() {
      if (!this.toggleValidation) {
        return [];
      }

      const validationErrors = [];

      this.config.forEach(page => {
        validationErrors.push(...this.getValidationErrorsForItems(page.items, page));
      });

      return validationErrors;
    },
  },
  mounted() {
    // Iterate through our initial config set, calling this.addControl
    controlConfig.forEach(config => {
      config.control.inspector.push(...globalProperties[0].inspector);

      this.addControl(
        config.control,
        config.rendererComponent,
        config.rendererBinding,
        config.builderComponent,
        config.builderBinding
      );
    });

    this.loadFromLocalStorage();
  },
  methods: {
    loadFromLocalStorage() {
      const savedConfig = localStorage.getItem('savedConfig');
      if (savedConfig) {
        let config = JSON.parse(savedConfig);
        this.$refs.builder.config = config;
      }
    },
    saveToLocalStorage() {
      localStorage.setItem('savedConfig', JSON.stringify(this.config));
    },
    editorDidMount(editor) {
      editor.getAction('editor.action.formatDocument').run();
    },
    getValidationErrorsForItems(items, page) {
      const validationErrors = [];

      items.forEach(item => {
        if (item.container) {
          item.items.forEach(containerItems => {
            if (!Array.isArray(containerItems)) {
              containerItems = [containerItems];
            }
            validationErrors.push(...this.getValidationErrorsForItems(containerItems, page));
          });
        }

        const data = item.config || {};
        const rules = {};

        item.inspector.forEach(property => {
          if (property.config.validation) {
            rules[property.field] = property.config.validation;
          }
        });

        const validator = new Validator(data, rules);

        // To include another language in the Validator with variable processmaker
        if (globalObject.ProcessMaker && globalObject.ProcessMaker.user && globalObject.ProcessMaker.user.lang) {
          validator.useLang(globalObject.ProcessMaker.user.lang);
        }

        // Validation will not run until you call passes/fails on it
        if (!validator.passes()) {
          Object.keys(validator.errors.errors).forEach(field => {
            validator.errors.errors[field].forEach(error => {
              validationErrors.push({
                message: error,
                page,
                item,
              });
            });
          });
        }
      });

      return validationErrors;
    },
    focusInspector(validate) {
      this.$refs.builder.focusInspector(validate);
    },
    openWatchersPopup() {
      this.$refs.watchersPopup.show();
    },
    openComputedProperties() {
      this.$refs.computedProperties.show();
    },
    openCustomCSS() {
      this.$refs.customCSS.show();
    },
    updateConfig(newConfig) {
      this.config = newConfig;
    },
    previewSubmit() {
      alert('Preview Form was Submitted');
    },
    addControl(control, rendererComponent, rendererBinding, builderComponent, builderBinding) {
      // Add it to the renderer
      this.$refs.renderer.$options.components[rendererBinding] = rendererComponent;
      // Add it to the form builder
      this.$refs.builder.addControl(control, builderComponent, builderBinding);
    },
  },
};
</script>

<style lang="scss">
    @import "~bootstrap/dist/css/bootstrap";

    $validation-panel-bottom: 3.5rem;
    $validation-panel-right: 0;
    $validation-panel-height: 10rem;
    $validation-panel-width: 21.35rem;
    $primary-white: #f7f7f7;

    $preview-inspector-width: 265px;
    $data-collapse-height: 300px;

    html,
    body {
        height: 100%;
        min-height: 100%;
        max-height: 100%;
        overflow: hidden;
    }

    .header-bg {
      background: $primary-white;
    }

    .validation-panel {
      background: $primary-white;
      height: $validation-panel-height;
      width: $validation-panel-width;
      bottom: $validation-panel-bottom;
      right: $validation-panel-right;
    }

    .card-header {
      border-radius: 0 !important;
    }

    .border-check {
      border: 1px solid green;
    }

    .list-group-item:last-child {
      border-bottom: 1px solid #dfdfdf !important;
    }

    .preview-inspector {
      max-width: $preview-inspector-width;
    }

    .data-collapse {
      height: $data-collapse-height;
    }

    .modal-backdrop {
      opacity: 0.5;
    }
</style>
