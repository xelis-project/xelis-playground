use std::collections::HashMap;

use xelis_common::{
    asset::AssetData,
    block::TopoHeight,
    contract::{ContractProvider, ContractStorage},
    crypto::{Hash, PublicKey},
    account::CiphertextCache,
};
use xelis_vm::ValueCell;
use async_trait::async_trait;

pub struct MockStorage {
    pub data: HashMap<ValueCell, ValueCell>,
    pub balances: HashMap<Hash, HashMap<Hash, u64>>,
}

#[async_trait]
impl ContractStorage for MockStorage {
    async fn load_data(&self, _: &Hash, key: &ValueCell, topoheight: TopoHeight) -> Result<Option<(TopoHeight, Option<ValueCell>)>, anyhow::Error> {
        Ok(Some((topoheight, self.data.get(key).cloned())))
    }

    async fn has_data(&self, _: &Hash, key: &ValueCell, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(self.data.contains_key(key))
    }

    async fn load_data_latest_topoheight(&self, _: &Hash, _: &ValueCell, topoheight: TopoHeight) -> Result<Option<TopoHeight>, anyhow::Error> {
        Ok(Some(topoheight))
    }

    async fn has_contract(&self, _: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }
}

#[async_trait]
impl ContractProvider for MockStorage {
    async fn get_contract_balance_for_asset(&self, contract: &Hash, asset: &Hash, topoheight: TopoHeight) -> Result<Option<(TopoHeight, u64)>, anyhow::Error> {
        let balance = self.balances
            .get(contract)
            .and_then(|m| m.get(asset))
            .copied()
            .unwrap_or(0);
        Ok(Some((topoheight, balance)))
    }

    async fn get_account_balance_for_asset(&self, _: &PublicKey, _: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, CiphertextCache)>, anyhow::Error> {
        Ok(None)
    }

    async fn asset_exists(&self, _: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }

    async fn load_asset_data(&self, _: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, AssetData)>, anyhow::Error> {
        Ok(None)
    }

    async fn load_asset_supply(&self, _: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, u64)>, anyhow::Error> {
        Ok(None)
    }

    async fn account_exists(&self, _: &PublicKey, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }
}