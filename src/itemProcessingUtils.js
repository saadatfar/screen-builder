function processFormItem(item) {
  if (item.component !== 'FormMultiColumn') {
    return item;
  }

  return item.items.flatMap(processFormItem);
}

export function getItemsFromConfig(config) {
  return config
    .flatMap(page => page.items)
    .flatMap(processFormItem);
}

export function getDefaultValueForItem(item) {
  let defaultValue = null;

  if (['FormInput', 'FormTextArea', 'FormText'].includes(item.component)) {
    defaultValue = '';
  }

  if (item.component === 'FormCheckbox') {
    defaultValue = item.config.initiallyChecked || false;
  }

  if (item.component === 'FormRecordList') {
    defaultValue = [];
  }

  if (item.component === 'FormDatePicker') {
    const date = new Date();
    defaultValue = date.toISOString();
  }
  return defaultValue;
}
