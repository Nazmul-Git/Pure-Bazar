'use client';

import MasterDataPage from '@/components/inventory/master-data-page';
import QuickAddCategoryModal from '@/components/inventory/quick-add-category-modal';
import { createCategory, deleteCategory, getCategories, updateCategory } from '@/services/inventory';

const columns = [
  { key: 'name', label: 'Category' },
  { key: 'vatRate', label: 'VAT rate', render: (rate) => rate == null ? '—' : `${rate}%` },
  { key: 'commissionPercent', label: 'Commission rate', render: (rate) => rate == null ? '—' : `${rate}%` },
  { key: 'commissionEnabled', label: 'Commission status', render: () => 'Disabled' },
];

export default function CategoriesPage() {
  return (
    <MasterDataPage
      title="Categories"
      itemName="Category"
      description="Organize products and manage category tax rates."
      resource="categories"
      itemProp="category"
      permission="categories"
      columns={columns}
      getItems={getCategories}
      createItem={createCategory}
      updateItem={updateCategory}
      deleteItem={deleteCategory}
      FormModal={QuickAddCategoryModal}
    />
  );
}
