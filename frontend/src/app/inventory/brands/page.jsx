'use client';

import MasterDataPage from '@/components/inventory/master-data-page';
import QuickAddBrandModal from '@/components/inventory/quick-add-brand-modal';
import { createBrand, deleteBrand, getBrands, updateBrand } from '@/services/inventory';

const columns = [
  { key: 'name', label: 'Brand' },
  { key: 'logoUrl', label: 'Logo', render: (url) => url ? 'Uploaded' : 'Not provided' },
];

export default function BrandsPage() {
  return (
    <MasterDataPage
      title="Brands"
      itemName="Brand"
      description="Maintain the brands available to your product catalog."
      resource="brands"
      itemProp="brand"
      permission="brands"
      columns={columns}
      getItems={getBrands}
      createItem={createBrand}
      updateItem={updateBrand}
      deleteItem={deleteBrand}
      FormModal={QuickAddBrandModal}
    />
  );
}
