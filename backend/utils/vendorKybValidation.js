const BUSINESS_TYPES = ['Proprietorship', 'Partnership', 'Private Limited', 'Cooperative'];
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const validDate = (value) => Boolean(text(value)) && Number.isFinite(new Date(value).getTime());

function validateVendorKyb(payload = {}, files = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const identity = payload.businessLegalIdentity || {};
  const owner = identity.ownerInfo || {};
  const logistics = payload.operationalAndWarehouseLogistics || {};

  if (!text(identity.companyName)) add('businessLegalIdentity.companyName', 'Company name is required');
  if (!text(identity.tradeLicenseNo)) add('businessLegalIdentity.tradeLicenseNo', 'Trade license number is required');
  if (!validDate(identity.tradeLicenseExpiry)) {
    add('businessLegalIdentity.tradeLicenseExpiry', 'A valid trade license expiry date is required');
  } else if (new Date(identity.tradeLicenseExpiry) < new Date(new Date().toISOString().slice(0, 10))) {
    add('businessLegalIdentity.tradeLicenseExpiry', 'Trade license has expired');
  }
  if (!BUSINESS_TYPES.includes(identity.businessType)) add('businessLegalIdentity.businessType', 'Select a valid business type');
  if (!text(owner.fullNameEng)) add('businessLegalIdentity.ownerInfo.fullNameEng', 'Owner full name is required');
  if (!/^(\d{10}|\d{13}|\d{17})$/.test(text(owner.nidNumber))) {
    add('businessLegalIdentity.ownerInfo.nidNumber', 'Owner NID must be 10, 13 or 17 digits');
  }
  if (text(owner.dob) && !validDate(owner.dob)) add('businessLegalIdentity.ownerInfo.dob', 'Date of birth is invalid');

  if (!text(logistics.warehouseAddress)) add('operationalAndWarehouseLogistics.warehouseAddress', 'Warehouse address is required');
  if (!text(logistics.primaryContactPerson)) add('operationalAndWarehouseLogistics.primaryContactPerson', 'Primary contact person is required');
  if (!/^\+?[0-9]{7,20}$/.test(text(logistics.dispatchMobile))) {
    add('operationalAndWarehouseLogistics.dispatchMobile', 'Dispatch mobile must contain 7 to 20 digits');
  }
  const lead = logistics.deliveryLeadTimeHours;
  if (lead !== undefined && lead !== null && lead !== '' && !(Number(lead) >= 0 && Number.isFinite(Number(lead)))) {
    add('operationalAndWarehouseLogistics.deliveryLeadTimeHours', 'Lead time must be zero or more hours');
  }

  if (!files.tradeLicense) add('tradeLicense', 'Trade license document is required');
  if (!files.ownerNid) add('ownerNid', 'Owner NID document is required');
  return errors;
}

function normalizeVendorKyb(payload) {
  const identity = payload.businessLegalIdentity;
  const owner = identity.ownerInfo;
  const logistics = payload.operationalAndWarehouseLogistics;
  const clean = (source, keys) => Object.fromEntries(keys.map((key) => [key, text(source[key])]));
  const lead = logistics.deliveryLeadTimeHours;
  return {
    businessLegalIdentity: {
      ...clean(identity, ['companyName', 'tradeLicenseNo', 'businessType', 'tinNumber', 'vatBinNumber']),
      tradeLicenseExpiry: new Date(identity.tradeLicenseExpiry),
      ownerInfo: {
        ...clean(owner, ['fullNameEng', 'fullNameBen', 'nidNumber', 'presentAddress', 'permanentAddress']),
        dob: text(owner.dob) ? new Date(owner.dob) : undefined,
      },
    },
    operationalAndWarehouseLogistics: {
      ...clean(logistics, ['warehouseAddress', 'primaryContactPerson', 'dispatchMobile']),
      productCategories: (Array.isArray(logistics.productCategories) ? logistics.productCategories : [])
        .map(text).filter(Boolean),
      deliveryLeadTimeHours: lead === undefined || lead === null || lead === '' ? undefined : Number(lead),
    },
  };
}

module.exports = { BUSINESS_TYPES, validateVendorKyb, normalizeVendorKyb };
