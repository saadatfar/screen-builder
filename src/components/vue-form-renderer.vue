<template>
  <div class="custom-css-scope">
    <div class="page">
      <div
        v-for="(element, index) in visibleElements"
        :key="index"
      >
        <component
          v-if="element.container"
          :class="elementCssClass(element)"
          ref="container"
          selected="selected"
          :transientData="transientData"
          v-model="element.items"
          @submit="submit"
          :config="element.config"
          :name="element.config.name !== undefined ? element.config.name : null"
          @pageNavigate="pageNavigate"
          v-bind="element.config"
          :is="element.component"
        />

        <div v-else :id="element.config.name ? element.config.name : undefined" :selector="element.config.customCssSelector">
          <keep-alive>
            <component
              :class="elementCssClass(element)"
              ref="elements"
              :validationData="transientData"
              v-model="model[getValidPath(element.config.name)]"
              @submit="submit"
              @pageNavigate="pageNavigate"
              :name="element.config.name !== undefined ? element.config.name : null"
              v-bind="element.config"
              :is="element.component"
              :disabled="element.config.interactive || element.config.disabled"
            />
          </keep-alive>
        </div>
      </div>
      <custom-css>{{ customCssWrapped }}</custom-css>
      <watchers-synchronous ref="watchersSynchronous"/>
    </div><!-- end page -->
  </div><!-- end custom-css-scope -->
</template>

<script>
import Vue from 'vue';
import * as VueDeepSet from 'vue-deepset';
import _ from 'lodash';
import { getValidPath, HasColorProperty, shouldElementBeVisible, formWatchers } from '@/mixins';
import * as editor from './editor';
import * as renderer from './renderer';
import * as inspector from './inspector';
import FormMultiColumn from '@/components/renderer/form-multi-column';
import FormLoop from '@/components/renderer/form-loop';
import FormMaskedInput from '@/components/renderer/form-masked-input';
import CustomCSS from './custom-css';
import {
  FormCheckbox,
  FormDatePicker,
  FormHtmlEditor,
  FormHtmlViewer,
  FormSelectList,
  FormTextArea,
} from '@processmaker/vue-form-elements';
import { Parser } from 'expr-eval';
import { getDefaultValueForItem, getItemsFromConfig } from '../itemProcessingUtils';
import WatchersSynchronous from '@/components/watchers-synchronous';
import { ValidatorFactory } from '../factories/ValidatorFactory';
import currencies from '../currency.json';
import Inputmask from 'inputmask';
import Mustache from 'mustache'

const csstree = require('css-tree');

Vue.component('custom-css', {
  render(createElement) {
    return createElement('style', this.$slots.default);
  },
});

Vue.use(VueDeepSet);

export default {
  name: 'VueFormRenderer',
  props: ['config', 'data', 'page', 'computed', 'customCss', 'mode', 'watchers'],
  model: {
    prop: 'data',
    event: 'update',
  },
  mixins: [HasColorProperty, shouldElementBeVisible, getValidPath, formWatchers],
  components: {
    FormInput: FormMaskedInput,
    WatchersSynchronous,
    FormSelectList,
    FormCheckbox,
    FormTextArea,
    FormDatePicker,
    FormHtmlEditor,
    FormHtmlViewer,
    FormMultiColumn,
    CustomCSS,
    FormLoop,
    ...editor,
    ...inspector,
    ...renderer,
  },
  computed: {
    model() {
      return this.$deepModel(this.transientData);
    },
    visibleElements() {
      return this.config[this.currentPage].items.filter(this.shouldElementBeVisible);
    },
  },
  data() {
    return {
      valid: true,
      errors: [],
      currentPage: this.page || 0,
      transientData: JSON.parse(JSON.stringify(this.data)),
      customCssWrapped: '',
      // Custom Functions for Rich Text Control
      customFunctions: {
        formatCurrency() {
          const format = (value, currency) => {
            const definition = currencies.find(definition => definition.code === currency);
            const options = { alias: 'currency' };
            if (definition) {
              const separators = definition.format.match(/[.,]/g);
              if (separators.length === 0) separators.push('', '.');
              else if (separators.length === 1) separators.push(separators[0] === '.' ? ',': '.');
              options.digits = (definition.format.split(separators[1])[1] || '').length;
              options.radixPoint = separators[1];
              options.groupSeparator = separators[0];
              options.prefix = definition.symbol + ' ';
              options.suffix = ' ' + definition.code;
            }
            return Inputmask.format(value, options);
          };
          return function(text) {
            const params = JSON.parse(`[${text}]`);
            return format(_.get(this, params[0]), params[1]);
          };
        },
      },
    };
  },
  watch: {
    mode() {
      this.currentPage = 0;
      this.applyConfiguredDefaultValues();
    },
    data() {
      this.transientData = JSON.parse(JSON.stringify(this.data));
      this.setDefaultValues();
    },
    transientData: {
      handler() {
        if (this.computed) {
          this.computed.forEach(prop => {
            let value;
            try {
              if (prop.type === 'expression') {
                value = Parser.evaluate(prop.formula, this.transientData);
              } else if (prop.type === 'javascript') {
                const func = new Function(prop.formula);
                value = func.bind(JSON.parse(JSON.stringify(this.transientData)))();
              }
            } catch (e) {
              value = String(e);
            }
            JSON.stringify(this.transientData[prop.property]) !== JSON.stringify(value) ? this.$set(this.transientData, prop.property, value) : null;
            JSON.stringify(this.data[prop.property]) !== JSON.stringify(value) ? this.$set(this.data, prop.property, value) : null;
          });
        }
        // Only emit the update message if transientData does NOT equal this.data
        // Instead of deep object property comparison, we'll just compare the JSON representations of both

        if (JSON.stringify(this.transientData) !== JSON.stringify(this.data)) {
          this.$emit('update', this.transientData);

          //Verify changes in the Data for the watchers call
          let diff = this.dataChanges(this.transientData, this.data);
          if (diff.length) {
            this.watchDataChanges(this.transientData, diff);
          }
        }
      },
      deep: true,
      immediate: true,
    },
    customCss() {
      this.parseCss();
    },
    config: {
      deep: true,
      handler() {
        this.$nextTick(() => {this.registerCustomFunctions();});
      },
    },
  },
  created() {
    this.parseCss = _.debounce(this.parseCss, 500, {leading: true});
  },
  mounted() {
    this.parseCss();
    this.registerCustomFunctions();
    if (window.ProcessMaker && window.ProcessMaker.EventBus) {
      window.ProcessMaker.EventBus.$emit('screen-renderer-init', this);
    }
    this.applyConfiguredDefaultValues();
  },
  methods: {
    applyConfiguredDefaultValues() {
      this.$nextTick(() => {
        getItemsFromConfig(this.config)
          .forEach(item => {
            if (item.config.defaultValue) {
              this.model[this.getValidPath(item.config.name)] = Mustache.render(item.config.defaultValue, this.transientData);
            }
        });
      });
    },
    registerCustomFunctions(node=this) {
      if (node.registerCustomFunction instanceof Function) {
        Object.keys(this.customFunctions).forEach(key => {
          node.registerCustomFunction(key, this.customFunctions[key]);
        });
      }
      if (node.$children instanceof Array) {
        node.$children.forEach(child => this.registerCustomFunctions(child));
      }
    },
    /**
     * Returns the names of the fields that have changed.
     *
     * @param {object} newData
     * @param {object} oldData
     * @returns {[]}
     */
    dataChanges(newData, oldData) {
      let changes = [];
      for (const field in newData) {
        if (oldData[field] !== undefined &&
          JSON.stringify(newData[field]) !== JSON.stringify(oldData[field])) {
          changes.push(field);
        }
      }
      return changes;
    },
    submit() {
      if (this.isValid()) {
        this.setDefaultValues();
        this.$emit('submit', this.transientData);
      }
    },
    isValid() {
      this.dataTypeValidator = ValidatorFactory(this.config, this.data);
      this.errors = this.dataTypeValidator.getErrors();
      return _.size(this.errors) === 0;
    },
    pageNavigate(page) {
      if (!this.config[page]) {
        return;
      }

      this.currentPage = page;
    },
    setDefaultValues() {
      const shouldHaveDefaultValue = item => {
        const shouldHaveDefaultValueSet = item.config.name &&
            this.model[this.getValidPath(item.config.name)] === undefined &&
            item.component !== 'FormButton';

        const isNotFormAccordion = item.component !== 'FormAccordion';

        return shouldHaveDefaultValueSet && isNotFormAccordion;
      };
      getItemsFromConfig(this.config)
        .filter(shouldHaveDefaultValue)
        .forEach(item => this.model[this.getValidPath(item.config.name)] = getDefaultValueForItem(item, this.transientData));
    },
    parseCss() {
      const containerSelector = '.custom-css-scope';
      try {
        const ast = csstree.parse(this.customCss, {
          onParseError(error) {
            // throw "CSS has the following errors:\n\n" + error.formattedMessage
            throw error.formattedMessage;
          },
        });
        let i = 0;
        csstree.walk(ast, function(node, item, list) {
          if (node.type === 'Atrule' && list) {
            throw 'CSS \'At-Rules\' (starting with @) are not allowed.';
          }
          if (
            node.type.match(/^.+Selector$/) &&
              node.name !== containerSelector &&
              list
          ) {
            // Wait until we get to the first item before prepending our container selector
            if (!item.prev) {
              list.prependData({type: 'WhiteSpace', loc: null, value: ' '});
              list.prependData({
                type: 'TypeSelector',
                loc: null,
                name: containerSelector,
              });
            }
          }
          if (i > 5000) {
            throw 'CSS is too big';
          }
          i = i + 1;
        });

        this.customCssWrapped = csstree.generate(ast);

        // clear errors
        this.$emit('css-errors', '');
      } catch (error) {
        this.$emit('css-errors', error);
      }
    },
  },
};
</script>
