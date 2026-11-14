use std::borrow::Cow;

use silex_types::{EnumVariant, StructType, TypePacked};
use xelis_common::config::MAX_GAS_USAGE_PER_TX;

use super::*;

#[tokio::test]
async fn test_hello_world() {
    let code = r#"
        entry hello_world(a: string, b: string) {
            assert(a == "Hello");
            assert(b == "world");
            println(a + ", " + b + "!");
            return 0;
        }
    "#;

    let silex = Silex::new();
    let program = silex
        .compile_internal(code)
        .expect("Failed to compile the program");
    let entries = program.entries();
    let entry = entries.get(0).expect("No entry found");
    let result = silex
        .execute_program_internal(
            program,
            entry.id() as u16,
            Some(MAX_GAS_USAGE_PER_TX),
            IndexMap::new(),
            vec![
                Primitive::String("Hello".to_string()).into(),
                Primitive::String("world".to_string()).into(),
            ],
            vec![],
            true,
        )
        .await
        .expect("Failed to execute the program");

    assert_eq!(result.value(), "0");
}

#[test]
fn test_v1_compiles_public_entry_parameters() {
    let code = r#"
        entry main(msg: string, username: string) {
            println(msg + " " + username)
            return 0
        }
    "#;

    let silex = Silex::new();
    let program = silex
        .compile_internal(code)
        .expect("Failed to compile the program");

    let chunk = program
        .contract
        .module
        .get_chunk_at(0)
        .expect("Chunk should be present");
    let params = chunk
        .access
        .parameters()
        .expect("Parameters should be present");

    assert_eq!(params.len(), 2);
    assert_eq!(params[0], TypePacked::String);
    assert_eq!(params[1], TypePacked::String);

    let serialized = program.to_bytes().expect("Serialization should succeed");
    let got =
        ContractModule::from_bytes(&serialized).expect("Serialized module should be deserialized");
    let params = got
        .module
        .get_chunk_at(0)
        .expect("Chunk should be present after deserialization")
        .access
        .parameters()
        .expect("Parameters should be present after deserialization");

    assert_eq!(params.len(), 2);
    assert_eq!(params[0], TypePacked::String);
    assert_eq!(params[1], TypePacked::String);
}

#[test]
fn test_parse_string_array_parameter() {
    let silex = Silex::new();
    let ty = Type::Array(Box::new(Type::String));

    let value = silex
        .parse_text_to_const("[hello, world]", &ty)
        .expect("Failed to parse string array");

    assert_eq!(
        value,
        OwnedValue::Object(vec![
            Primitive::String("hello".to_owned()).into(),
            Primitive::String("world".to_owned()).into(),
        ])
    );
}

#[test]
fn test_parse_nested_parameter_combinations() {
    let silex = Silex::new();
    let ty = Type::Map(
        Box::new(Type::String),
        Box::new(Type::Array(Box::new(Type::U64))),
    );

    let value = silex
        .parse_text_to_const("{first: [1, 2], second: [3]}", &ty)
        .expect("Failed to parse nested map/array");

    let OwnedValue::Map(map) = &value else {
        panic!("Expected map value");
    };

    let first_key: OwnedValue = Primitive::String("first".to_owned()).into();
    let first = map.get(&first_key).expect("Missing first key");
    assert_eq!(
        first,
        &OwnedValue::Object(vec![
            Primitive::Integer(PrimitiveInteger::U64(1)).into(),
            Primitive::Integer(PrimitiveInteger::U64(2)).into(),
        ])
    );

    let second_key: OwnedValue = Primitive::String("second".to_owned()).into();
    let second = map.get(&second_key).expect("Missing second key");
    assert_eq!(
        second,
        &OwnedValue::Object(vec![Primitive::Integer(PrimitiveInteger::U64(3)).into(),])
    );
}

#[test]
fn test_parse_struct_and_enum_parameters() {
    let silex = Silex::new();
    let struct_type = StructType::new(
        1,
        "Payload",
        vec![
            (Cow::Borrowed("names"), Type::Array(Box::new(Type::String))),
            (Cow::Borrowed("enabled"), Type::Bool),
        ],
    );

    let value = silex
        .parse_text_to_const(
            "{names: [alice, bob], enabled: true}",
            &Type::Struct(struct_type),
        )
        .expect("Failed to parse struct");

    assert_eq!(
        value,
        OwnedValue::Object(vec![
            OwnedValue::Object(vec![
                Primitive::String("alice".to_owned()).into(),
                Primitive::String("bob".to_owned()).into(),
            ])
            .into(),
            Primitive::Boolean(true).into(),
        ])
    );

    let enum_type = silex_types::EnumType::new(
        2,
        "Choice",
        vec![
            (Cow::Borrowed("None"), EnumVariant::new(Vec::new())),
            (
                Cow::Borrowed("Names"),
                EnumVariant::new(vec![(
                    Cow::Borrowed("values"),
                    Type::Array(Box::new(Type::String)),
                )]),
            ),
        ],
    );

    let value = silex
        .parse_text_to_const(
            "Choice::Names{values: [alice, bob]}",
            &Type::Enum(enum_type),
        )
        .expect("Failed to parse enum");

    assert_eq!(
        value,
        OwnedValue::Object(vec![
            Primitive::Integer(PrimitiveInteger::U8(1)).into(),
            OwnedValue::Object(vec![
                Primitive::String("alice".to_owned()).into(),
                Primitive::String("bob".to_owned()).into(),
            ])
            .into(),
        ])
    );
}

#[tokio::test]
async fn test_execute_program_with_string_array_parameter() {
    let code = r#"
        entry assert_strings(values: string[]) {
            assert(values.len() == 2);
            assert(values[0] == "hello");
            assert(values[1] == "world");
            return 0;
        }
    "#;

    let silex = Silex::new();
    let program = silex
        .compile_internal(code)
        .expect("Failed to compile the program");
    let entry = program.entries().get(0).expect("No entry found").clone();
    let value = silex
        .parse_text_to_const("[hello, world]", &entry.parameters[0].ty)
        .expect("Failed to parse entry parameter");
    let result = silex
        .execute_program_internal(
            program,
            entry.id() as u16,
            Some(MAX_GAS_USAGE_PER_TX),
            IndexMap::new(),
            vec![value],
            vec![],
            true,
        )
        .await
        .expect("Failed to execute the program");

    assert_eq!(result.value(), "0");
}

async fn run_source(silex: &Silex, code: &str, gas: u64) -> ExecutionResult {
    let program = silex.compile_internal(code).expect("compile");
    let chunk = program.entries[0].chunk_id;
    silex
        .execute_program_internal(
            program,
            chunk,
            Some(gas),
            IndexMap::new(),
            vec![],
            vec![],
            true,
        )
        .await
        .expect("execution")
}

#[tokio::test]
async fn logs_are_isolated_between_instances_and_runs() {
    let first = Silex::new();
    let second = Silex::new();
    let a = run_source(
        &first,
        "entry main() { println(\"first\"); return 0; }",
        MAX_GAS_USAGE_PER_TX,
    )
    .await;
    let b = run_source(
        &second,
        "entry main() { println(\"second\"); return 0; }",
        MAX_GAS_USAGE_PER_TX,
    )
    .await;
    let c = run_source(&first, "entry main() { return 0; }", MAX_GAS_USAGE_PER_TX).await;
    assert_eq!(a.logs(), ["first"]);
    assert_eq!(b.logs(), ["second"]);
    assert!(c.logs().is_empty());
}

#[tokio::test]
async fn constructor_storage_and_events_survive_runtime_boundary() {
    let result = run_source(
        &Silex::new(),
        r#"
        hook constructor() -> u64 {
            Storage::new().store("count", 41u64);
            return 0;
        }
        entry main() {
            let storage = Storage::new();
            let count = (storage.load("count").unwrap() as u64) + 1;
            storage.store("count", count);
            emit_event(7, [count]);
            return 0;
        }
    "#,
        MAX_GAS_USAGE_PER_TX,
    )
    .await;
    assert!(!result.is_error(), "{}", result.value());
    assert_eq!(result.storage()[0].value(), "42");
    assert_eq!(result.events()[0].event_id(), 7);
    assert_eq!(result.events()[0].event(), "[42]");
}

#[tokio::test]
async fn gas_exhaustion_is_an_execution_error() {
    let result = run_source(&Silex::new(), "entry main() { return 0; }", 0).await;
    assert!(result.is_error());
}

#[test]
fn portable_ranges_bytes_and_numbers_parse() {
    let silex = Silex::new();
    assert_eq!(
        silex
            .parse_text_to_const("18446744073709551615", &Type::U64)
            .unwrap(),
        OwnedValue::from(u64::MAX)
    );
    let range = silex
        .parse_text_to_const("1..4", &Type::Range(Box::new(Type::U64)))
        .unwrap();
    assert_eq!(range.to_string(), "1..4");
}

#[tokio::test]
async fn deposits_are_indexed_by_contract_then_asset() {
    let silex = Silex::new();
    let program = silex
        .compile_internal("entry main() { return 0; }")
        .unwrap();
    let asset = Hash::new([7; 32]);
    let deposits = [(asset.clone(), ContractDeposit::Public(123))]
        .into_iter()
        .collect();
    let result = silex
        .execute_program_internal(
            program,
            0,
            Some(MAX_GAS_USAGE_PER_TX),
            deposits,
            vec![],
            vec![],
            false,
        )
        .await
        .unwrap();
    assert_eq!(result.storage.balances[&Hash::zero()][&asset], 123);
}

#[tokio::test]
async fn missing_storage_keys_have_no_topoheight() {
    use xelis_common::contract::ContractStorage;
    let storage = MockStorage {
        data: HashMap::new(),
        balances: HashMap::new(),
        assets: HashMap::new(),
    };
    assert_eq!(
        storage
            .load_data_latest_topoheight(&Hash::zero(), &OwnedValue::from(1u64), 10)
            .await
            .unwrap(),
        None
    );
}
