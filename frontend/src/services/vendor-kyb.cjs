const BUSINESS_TYPES = ['Proprietorship', 'Partnership', 'Private Limited', 'Cooperative'];

const emptyKybForm = {
  companyName: '',
  tradeLicenseNo: '',
  tradeLicenseExpiry: '',
  businessType: '',
  tinNumber: '',
  vatBinNumber: '',
  fullNameEng: '',
  fullNameBen: '',
  nidNumber: '',
  dob: '',
  presentAddress: '',
  permanentAddress: '',
  warehouseAddress: '',
  primaryContactPerson: '',
  dispatchMobile: '',
  productCategories: '',
  deliveryLeadTimeHours: '',
};

const BUSINESS_FIELDS = ['companyName', 'tradeLicenseNo', 'tradeLicenseExpiry', 'businessType', 'nidNumber', 'fullNameEng'];
const LOGISTICS_FIELDS = ['warehouseAddress', 'primaryContactPerson', 'dispatchMobile', 'deliveryLeadTimeHours'];
const STEP_FIELDS = [[...BUSINESS_FIELDS, 'tradeLicense', 'ownerNid', 'dob'], LOGISTICS_FIELDS];

function validateKybForm(form, files = {}, today = new Date().toISOString().slice(0, 10)) {
  const errors = {};
  const v = (key) => String(form[key] ?? '').trim();
  if (!v('companyName')) errors.companyName = 'Company name is required';
  if (!v('tradeLicenseNo')) errors.tradeLicenseNo = 'Trade license number is required';
  if (!v('tradeLicenseExpiry')) errors.tradeLicenseExpiry = 'Trade license expiry is required';
  else if (v('tradeLicenseExpiry') < today) errors.tradeLicenseExpiry = 'Trade license has expired';
  if (!BUSINESS_TYPES.includes(v('businessType'))) errors.businessType = 'Select a business type';
  if (!v('fullNameEng')) errors.fullNameEng = 'Owner full name is required';
  if (!/^(\d{10}|\d{13}|\d{17})$/.test(v('nidNumber'))) errors.nidNumber = 'Owner NID must be 10, 13 or 17 digits';
  if (!files.tradeLicense) errors.tradeLicense = 'Upload the trade license document';
  if (!files.ownerNid) errors.ownerNid = 'Upload the owner NID document';
  if (!v('warehouseAddress')) errors.warehouseAddress = 'Warehouse address is required';
  if (!v('primaryContactPerson')) errors.primaryContactPerson = 'Primary contact person is required';
  if (!/^\+?[0-9]{7,20}$/.test(v('dispatchMobile'))) errors.dispatchMobile = 'Dispatch mobile must contain 7 to 20 digits';
  if (v('deliveryLeadTimeHours') && !(Number(v('deliveryLeadTimeHours')) >= 0)) {
    errors.deliveryLeadTimeHours = 'Lead time must be zero or more hours';
  }
  return errors;
}

function buildKybPayload(form) {
  const v = (key) => String(form[key] ?? '').trim();
  return {
    businessLegalIdentity: {
      companyName: v('companyName'),
      tradeLicenseNo: v('tradeLicenseNo'),
      tradeLicenseExpiry: v('tradeLicenseExpiry'),
      businessType: v('businessType'),
      tinNumber: v('tinNumber'),
      vatBinNumber: v('vatBinNumber'),
      ownerInfo: {
        fullNameEng: v('fullNameEng'),
        fullNameBen: v('fullNameBen'),
        nidNumber: v('nidNumber'),
        dob: v('dob'),
        presentAddress: v('presentAddress'),
        permanentAddress: v('permanentAddress'),
      },
    },
    operationalAndWarehouseLogistics: {
      warehouseAddress: v('warehouseAddress'),
      primaryContactPerson: v('primaryContactPerson'),
      dispatchMobile: v('dispatchMobile'),
      productCategories: v('productCategories').split(',').map((item) => item.trim()).filter(Boolean),
      deliveryLeadTimeHours: v('deliveryLeadTimeHours'),
    },
  };
}

module.exports = {
  BUSINESS_TYPES, emptyKybForm, STEP_FIELDS, validateKybForm, buildKybPayload,
};
