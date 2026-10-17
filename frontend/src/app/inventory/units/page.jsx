'use client';

import MasterDataPage from '@/components/inventory/master-data-page';
import QuickAddUnitModal from '@/components/inventory/quick-add-unit-modal';
import { createUnit, deleteUnit, getUnits, updateUnit } from '@/services/inventory';

const columns = [
  { key: 'name', label: 'Unit' },
  { key: 'abbreviation', label: 'Abbreviation' },
];

export default function UnitsPage() {
  return (
    <MasterDataPage
      title="Units"
      itemName="Unit"
      description="Manage product measurement and package units."
      resource="units"
      itemProp="unit"
      permission="units"
      columns={columns}
      getItems={getUnits}
      createItem={createUnit}
      updateItem={updateUnit}
      deleteItem={deleteUnit}
      FormModal={QuickAddUnitModal}
    />
  );
}
