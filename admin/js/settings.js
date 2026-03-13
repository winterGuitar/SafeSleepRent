// 加载设置
async function loadSettings() {
  try {
    // 加载押金规则
    const depositResponse = await getDepositRules();
    if (depositResponse.code === 200) {
      const rules = depositResponse.data;
      document.getElementById('setting-deposit-multiplier').value = rules.multiplier || 10;
      document.getElementById('setting-min-deposit').value = rules.minDeposit || 200;
      document.getElementById('setting-max-deposit').value = rules.maxDeposit || 2000;
    }

    // 加载营业时间
    const businessResponse = await getBusinessHours();
    if (businessResponse.code === 200) {
      const hours = businessResponse.data;
      document.getElementById('setting-business-start').value = hours.start || '08:00';
      document.getElementById('setting-business-end').value = hours.end || '20:00';
    }

  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings() {
  const settings = {
    depositRules: {
      multiplier: parseInt(document.getElementById('setting-deposit-multiplier').value),
      minDeposit: parseInt(document.getElementById('setting-min-deposit').value),
      maxDeposit: parseInt(document.getElementById('setting-max-deposit').value)
    },
    businessHours: {
      start: document.getElementById('setting-business-start').value,
      end: document.getElementById('setting-business-end').value
    },
    inventory: {
      warningLevel: parseInt(document.getElementById('setting-inventory-warning').value),
      allowOverbooking: document.getElementById('setting-allow-overbooking').checked
    }
  };

  try {
    const response = await saveSystemSettings(settings);
    if (response.code === 200) {
      showSuccess('设置保存成功');

      // 通知小程序刷新数据
      await notifyMiniprogramRefresh('settings_update', settings);
    } else {
      showError(response.message || '保存设置失败');
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    showError('保存设置失败');
  }
}
