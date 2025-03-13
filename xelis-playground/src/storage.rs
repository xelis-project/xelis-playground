use std::collections::HashMap;

use xelis_common::{
    asset::AssetData,
    block::TopoHeight,
    contract::{ContractProvider, ContractStorage},
    crypto::{Hash, PublicKey}
};
use xelis_vm::ValueCell;

pub struct MockStorage {
    pub data: HashMap<ValueCell, ValueCell>,
    pub balances: HashMap<Hash, HashMap<Hash, u64>>,
}

impl ContractStorage for MockStorage {
    fn load_data(&self, _: &Hash, key: &ValueCell, topoheight: TopoHeight) -> Result<Option<(TopoHeight, Option<ValueCell>)>, anyhow::Error> {
        Ok(Some((topoheight, self.data.get(key).cloned())))
    }

    fn has_data(&self, _: &Hash, key: &ValueCell, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(self.data.contains_key(&key))
    }

    fn load_data_latest_topoheight(&self, _: &Hash, _: &ValueCell, topoheight: TopoHeight) -> Result<Option<TopoHeight>, anyhow::Error> {
        Ok(Some(topoheight))
    }
}

impl ContractProvider for MockStorage {
    fn get_contract_balance_for_asset(&self, contract: &Hash, asset: &Hash, topoheight: TopoHeight) -> Result<Option<(TopoHeight, u64)>, anyhow::Error> {
        Ok(Some((topoheight, *self.balances.get(contract).and_then(|m| m.get(asset)).unwrap_or(&0))))
    }

    fn account_exists(&self, _: &PublicKey, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }

    fn load_asset_data(&self, _: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, AssetData)>, anyhow::Error> {
        Ok(None)
    }

    fn asset_exists(&self, _: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }

    fn load_asset_supply(&self, _: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, u64)>, anyhow::Error> {
        Ok(None)
    }
}