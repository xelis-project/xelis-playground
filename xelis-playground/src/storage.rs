use std::collections::HashMap;

use xelis_common::{
    account::CiphertextCache,
    asset::AssetData,
    block::TopoHeight,
    contract::{ContractModule, ContractProvider, ContractStorage},
    crypto::{Hash, PublicKey}
};
use xelis_vm::ValueCell;
use async_trait::async_trait;

pub struct MockStorage {
    pub data: HashMap<Hash, HashMap<ValueCell, ValueCell>>,
    pub balances: HashMap<Hash, HashMap<Hash, u64>>,
    pub assets: HashMap<Hash, (AssetData, u64)>,
}

#[async_trait]
impl ContractStorage for MockStorage {
    async fn load_data(&self, contract: &Hash, key: &ValueCell, topoheight: TopoHeight) -> Result<Option<(TopoHeight, Option<ValueCell>)>, anyhow::Error> {
        let cache = self.data.get(contract)
            .map(|m| m.get(key).cloned())
            .flatten();
        Ok(Some((topoheight, cache)))
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

    async fn has_scheduled_execution_at_topoheight(&self, _: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }

    async fn asset_exists(&self, asset: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(self.assets.contains_key(asset))
    }

    async fn load_asset_data(&self, asset: &Hash, _: TopoHeight) -> Result<Option<(TopoHeight, AssetData)>, anyhow::Error> {
        Ok(self.assets.get(asset).cloned().map(|data| (0, data.0)))
    }

    // Load the asset supply
    // Supply is the current circulating supply
    async fn load_asset_circulating_supply(&self, hash: &Hash, topoheight: TopoHeight) -> Result<(TopoHeight, u64), anyhow::Error> {
        let supply = self.assets.get(hash).map(|a| a.1).unwrap_or(0);
        Ok((topoheight, supply))
    }

    async fn account_exists(&self, _: &PublicKey, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }

    async fn load_contract_module(&self, _: &Hash, _: TopoHeight) -> Result<Option<ContractModule>, anyhow::Error> {
        Ok(None)
    }

    async fn has_contract_callback_for_event(&self, _: &Hash, _: u64, _: &Hash, _: TopoHeight) -> Result<bool, anyhow::Error> {
        Ok(false)
    }
}