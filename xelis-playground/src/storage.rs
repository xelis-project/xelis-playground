use std::collections::HashMap;

use xelis_common::{block::TopoHeight, contract::{ContractProvider, ContractStorage}, crypto::Hash};
use xelis_vm::Constant;

pub struct MockStorage {
    pub data: HashMap<Constant, Constant>,
    pub balances: HashMap<Hash, HashMap<Hash, u64>>,
}

impl ContractStorage for MockStorage {
    fn load(&self, _: &Hash, key: &Constant, topoheight: TopoHeight) -> Result<Option<(TopoHeight, Option<Constant>)>, anyhow::Error> {
        Ok(Some((topoheight, self.data.get(key).cloned())))
    }

    fn has(&self, _: &Hash, key: &Constant, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(self.data.contains_key(&key))
    }

    fn load_latest_topoheight(&self, _: &Hash, _: &Constant, topoheight: TopoHeight) -> Result<Option<TopoHeight>, anyhow::Error> {
        Ok(Some(topoheight))
    }
}

impl ContractProvider for MockStorage {
    fn get_contract_balance_for_asset(&self, contract: &Hash, asset: &Hash, topoheight: TopoHeight) -> Result<Option<(TopoHeight, u64)>, anyhow::Error> {
        Ok(Some((topoheight, *self.balances.get(contract).and_then(|m| m.get(asset)).unwrap_or(&0))))
    }
}