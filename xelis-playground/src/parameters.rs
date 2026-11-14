//! Conversion of browser inputs to portable VM values.
use super::*;

#[wasm_bindgen]
impl Silex {
    fn parse_str_to_number<T: std::str::FromStr>(value: &str) -> Result<T, JsValue> {
        value
            .trim()
            .parse::<T>()
            .map_err(|_| JsValue::from_str("Failed to parse the value as a number"))
    }

    fn js_value_to_string(value: JsValue) -> Result<String, JsValue> {
        if let Some(value) = value.as_string() {
            return Ok(value);
        }

        if let Some(value) = value.as_bool() {
            return Ok(value.to_string());
        }

        if let Some(value) = value.as_f64() {
            return Ok(value.to_string());
        }

        Err(JsValue::from_str("Expected a string-compatible value"))
    }

    fn parse_string_literal(value: &str) -> String {
        let trimmed = value.trim();
        let Some(quote) = trimmed.chars().next() else {
            return String::new();
        };

        if !matches!(quote, '"' | '\'') || !trimmed.ends_with(quote) || trimmed.len() < 2 {
            return value.to_owned();
        }

        let inner = &trimmed[quote.len_utf8()..trimmed.len() - quote.len_utf8()];
        let mut output = String::with_capacity(inner.len());
        let mut chars = inner.chars();

        while let Some(ch) = chars.next() {
            if ch != '\\' {
                output.push(ch);
                continue;
            }

            match chars.next() {
                Some('n') => output.push('\n'),
                Some('r') => output.push('\r'),
                Some('t') => output.push('\t'),
                Some('\\') => output.push('\\'),
                Some('"') => output.push('"'),
                Some('\'') => output.push('\''),
                Some(other) => output.push(other),
                None => output.push('\\'),
            }
        }

        output
    }

    fn strip_wrapping<'a>(
        value: &'a str,
        open: char,
        close: char,
        expected: &str,
    ) -> Result<&'a str, JsValue> {
        let value = value.trim();
        if !value.starts_with(open) || !value.ends_with(close) {
            return Err(JsValue::from_str(&format!(
                "Expected {} value wrapped in {}{}",
                expected, open, close
            )));
        }

        Ok(&value[open.len_utf8()..value.len() - close.len_utf8()])
    }

    fn find_top_level_delimiter(value: &str, delimiter: char) -> Result<Option<usize>, JsValue> {
        let mut stack = Vec::new();
        let mut quote = None;
        let mut escaped = false;

        for (index, ch) in value.char_indices() {
            if let Some(active_quote) = quote {
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == active_quote {
                    quote = None;
                }
                continue;
            }

            match ch {
                '"' | '\'' => quote = Some(ch),
                '[' => stack.push(']'),
                '{' => stack.push('}'),
                '(' => stack.push(')'),
                ']' | '}' | ')' => {
                    if stack.pop() != Some(ch) {
                        return Err(JsValue::from_str(
                            "Mismatched delimiters in parameter value",
                        ));
                    }
                }
                _ if ch == delimiter && stack.is_empty() => return Ok(Some(index)),
                _ => {}
            }
        }

        if quote.is_some() || !stack.is_empty() {
            return Err(JsValue::from_str("Unclosed delimiter in parameter value"));
        }

        Ok(None)
    }

    fn split_top_level(value: &str, delimiter: char) -> Result<Vec<&str>, JsValue> {
        let value = value.trim();
        if value.is_empty() {
            return Ok(Vec::new());
        }

        let mut parts = Vec::new();
        let mut start = 0;
        let mut stack = Vec::new();
        let mut quote = None;
        let mut escaped = false;

        for (index, ch) in value.char_indices() {
            if let Some(active_quote) = quote {
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == active_quote {
                    quote = None;
                }
                continue;
            }

            match ch {
                '"' | '\'' => quote = Some(ch),
                '[' => stack.push(']'),
                '{' => stack.push('}'),
                '(' => stack.push(')'),
                ']' | '}' | ')' => {
                    if stack.pop() != Some(ch) {
                        return Err(JsValue::from_str(
                            "Mismatched delimiters in parameter value",
                        ));
                    }
                }
                _ if ch == delimiter && stack.is_empty() => {
                    let part = value[start..index].trim();
                    if part.is_empty() {
                        return Err(JsValue::from_str("Empty item in parameter value"));
                    }

                    parts.push(part);
                    start = index + ch.len_utf8();
                }
                _ => {}
            }
        }

        if quote.is_some() || !stack.is_empty() {
            return Err(JsValue::from_str("Unclosed delimiter in parameter value"));
        }

        let part = value[start..].trim();
        if part.is_empty() {
            return Err(JsValue::from_str("Empty trailing item in parameter value"));
        }

        parts.push(part);
        Ok(parts)
    }

    fn parse_text_to_primitive(value: &str, param: &Type) -> Result<Primitive, JsValue> {
        Ok(match param {
            Type::U8 => Primitive::Integer(PrimitiveInteger::U8(Self::parse_str_to_number(value)?)),
            Type::U16 => {
                Primitive::Integer(PrimitiveInteger::U16(Self::parse_str_to_number(value)?))
            }
            Type::U32 => {
                Primitive::Integer(PrimitiveInteger::U32(Self::parse_str_to_number(value)?))
            }
            Type::U64 => {
                Primitive::Integer(PrimitiveInteger::U64(Self::parse_str_to_number(value)?))
            }
            Type::U128 => {
                Primitive::Integer(PrimitiveInteger::U128(Self::parse_str_to_number(value)?))
            }
            Type::U256 => {
                Primitive::Integer(PrimitiveInteger::U256(Self::parse_str_to_number(value)?))
            }
            Type::String => Primitive::String(Self::parse_string_literal(value)),
            Type::Bool => Primitive::Boolean(
                value
                    .trim()
                    .parse::<bool>()
                    .map_err(|_| JsValue::from_str("Failed to parse as bool value"))?,
            ),
            Type::Range(inner) => {
                let parts: Vec<&str> = value.split("..").collect();
                if parts.len() != 2 {
                    return Err(JsValue::from_str("Invalid range format"));
                }

                let start = Self::parse_text_to_primitive(parts[0], inner)?;
                let end = Self::parse_text_to_primitive(parts[1], inner)?;

                Primitive::Range(Box::new(
                    PrimitiveRange::try_from((start, end))
                        .map_err(|err| JsValue::from_str(&err.to_string()))?,
                ))
            }
            Type::Function(_) => {
                Primitive::Integer(PrimitiveInteger::U16(Self::parse_str_to_number(value)?))
            }
            _ => {
                return Err(JsValue::from_str(&format!(
                    "Unsupported parameter type parsing: {}",
                    param
                )));
            }
        })
    }

    fn parse_record_fields(
        &self,
        value: &str,
        fields: &[(Cow<'static, str>, Type)],
        owner: &str,
    ) -> Result<Vec<OwnedValue>, JsValue> {
        let parts = Self::split_top_level(value, ',')?;
        if parts.len() != fields.len() {
            return Err(JsValue::from_str(&format!(
                "Invalid field count for {}: expected {}, got {}",
                owner,
                fields.len(),
                parts.len()
            )));
        }

        parts
            .into_iter()
            .zip(fields.iter())
            .map(|(part, (field_name, field_type))| {
                let value = if let Some(index) = Self::find_top_level_delimiter(part, ':')? {
                    let name = part[..index].trim();
                    if name != field_name.as_ref() {
                        return Err(JsValue::from_str(&format!(
                            "Invalid field name for {}: expected `{}`, got `{}`",
                            owner, field_name, name
                        )));
                    }

                    &part[index + ':'.len_utf8()..]
                } else {
                    part
                };

                self.parse_text_to_const(value.trim(), field_type)
            })
            .collect()
    }

    fn parse_array_text(&self, value: &str, inner: &Type) -> Result<OwnedValue, JsValue> {
        let value = Self::strip_wrapping(value, '[', ']', "array")?;
        let values = Self::split_top_level(value, ',')?
            .into_iter()
            .map(|part| self.parse_text_to_const(part, inner).map(Into::into))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(OwnedValue::Object(values))
    }

    fn parse_tuple_text(&self, value: &str, types: &[Type]) -> Result<OwnedValue, JsValue> {
        let value = value.trim();
        let value = if value.starts_with('(') {
            Self::strip_wrapping(value, '(', ')', "tuple")?
        } else {
            Self::strip_wrapping(value, '[', ']', "tuple")?
        };

        let parts = Self::split_top_level(value, ',')?;
        if parts.len() != types.len() {
            return Err(JsValue::from_str(&format!(
                "Invalid tuple item count: expected {}, got {}",
                types.len(),
                parts.len()
            )));
        }

        let values = parts
            .into_iter()
            .zip(types.iter())
            .map(|(part, ty)| self.parse_text_to_const(part, ty).map(Into::into))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(OwnedValue::Object(values))
    }

    fn parse_map_text(
        &self,
        value: &str,
        key_type: &Type,
        value_type: &Type,
    ) -> Result<OwnedValue, JsValue> {
        let value = Self::strip_wrapping(value, '{', '}', "map")?;
        let mut map = IndexMap::new();

        for part in Self::split_top_level(value, ',')? {
            let index = Self::find_top_level_delimiter(part, ':')?
                .ok_or_else(|| JsValue::from_str("Expected `key: value` map entry"))?;
            let key = self.parse_text_to_const(part[..index].trim(), key_type)?;
            let value =
                self.parse_text_to_const(part[index + ':'.len_utf8()..].trim(), value_type)?;

            map.insert(key, value.into());
        }

        Ok(OwnedValue::Map(map))
    }

    fn parse_struct_text(
        &self,
        value: &str,
        ty: &silex_types::StructType,
    ) -> Result<OwnedValue, JsValue> {
        let value = Self::strip_wrapping(value, '{', '}', ty.name())?;
        let values = self
            .parse_record_fields(value, ty.fields(), ty.name())?
            .into_iter()
            .map(Into::into)
            .collect();

        Ok(OwnedValue::Object(values))
    }

    fn parse_enum_text(
        &self,
        value: &str,
        ty: &silex_types::EnumType,
    ) -> Result<OwnedValue, JsValue> {
        let value = value.trim();
        let value = value
            .rsplit_once("::")
            .map(|(_, variant)| variant)
            .unwrap_or(value);

        let payload_start = value
            .char_indices()
            .find(|(_, ch)| matches!(ch, '{' | '('))
            .map(|(index, ch)| (index, ch));

        let (variant_name, payload) = match payload_start {
            Some((index, open)) => {
                let close = if open == '{' { '}' } else { ')' };
                let payload = Self::strip_wrapping(&value[index..], open, close, "enum variant")?;
                (value[..index].trim(), Some(payload))
            }
            None => (value.trim(), None),
        };

        let (variant_id, (_, variant)) = ty
            .variants()
            .iter()
            .enumerate()
            .find(|(_, (name, _))| name.as_ref() == variant_name)
            .ok_or_else(|| {
                JsValue::from_str(&format!(
                    "Unknown enum variant `{}` for {}",
                    variant_name,
                    ty.name()
                ))
            })?;

        let variant_id = u8::try_from(variant_id)
            .map_err(|_| JsValue::from_str("Enum variant id exceeds u8"))?;

        let mut values = vec![Primitive::Integer(PrimitiveInteger::U8(variant_id)).into()];
        if variant.fields().is_empty() {
            if payload
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
            {
                return Err(JsValue::from_str(&format!(
                    "Enum variant `{}` does not accept fields",
                    variant_name
                )));
            }

            return Ok(OwnedValue::Object(values));
        }

        let payload = payload.ok_or_else(|| {
            JsValue::from_str(&format!("Enum variant `{}` requires fields", variant_name))
        })?;

        values.extend(
            self.parse_record_fields(payload, variant.fields(), variant_name)?
                .into_iter()
                .map(Into::into),
        );

        Ok(OwnedValue::Object(values))
    }

    fn parse_untyped_text(&self, value: &str) -> Result<OwnedValue, JsValue> {
        let trimmed = value.trim();
        if trimmed.eq_ignore_ascii_case("null") || trimmed.is_empty() {
            return Ok(Primitive::Null.into());
        }

        if trimmed.eq_ignore_ascii_case("true") || trimmed.eq_ignore_ascii_case("false") {
            return Ok(Primitive::Boolean(trimmed.parse::<bool>().unwrap()).into());
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            return self.parse_array_text(trimmed, &Type::Any);
        }

        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            return self.parse_map_text(trimmed, &Type::Any, &Type::Any);
        }

        if trimmed.starts_with('"') || trimmed.starts_with('\'') {
            return Ok(Primitive::String(Self::parse_string_literal(trimmed)).into());
        }

        if let Ok(value) = trimmed.parse::<u64>() {
            return Ok(Primitive::Integer(PrimitiveInteger::U64(value)).into());
        }

        Ok(Primitive::String(value.to_owned()).into())
    }

    pub(super) fn parse_text_to_const(
        &self,
        value: &str,
        param: &Type,
    ) -> Result<OwnedValue, JsValue> {
        Ok(match param {
            Type::Optional(ty) => {
                let trimmed = value.trim();
                if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
                    Primitive::Null.into()
                } else {
                    self.parse_text_to_const(value, ty)?
                }
            }
            Type::Voidable(ty) => self.parse_text_to_const(value, ty)?,
            Type::Bytes => {
                let value = Self::parse_string_literal(value);
                let value = value.strip_prefix("0x").unwrap_or(&value);
                let bytes = hex::decode(value)
                    .map_err(|_| JsValue::from_str("Failed to parse as blob (hex) value"))?;
                OwnedValue::Bytes(bytes)
            }
            Type::Opaque(ty) => {
                let environment = &self.environments[&self.selected_version];
                let name = environment
                    .get_opaque_name(ty)
                    .ok_or_else(|| JsValue::from_str("Failed to get opaque name"))?;

                match name {
                    "Hash" => {
                        let value = Self::parse_string_literal(value);
                        let hash = Hash::from_hex(&value)
                            .map_err(|_| JsValue::from_str("Failed to parse as hash value"))?;
                        OwnedValue::Opaque(hash.into()).into()
                    }
                    "Ciphertext" => {
                        let value = Self::parse_string_literal(value);
                        let ciphertext = CiphertextCache::from_hex(&value).map_err(|_| {
                            JsValue::from_str("Failed to parse as ciphertext value")
                        })?;
                        OwnedValue::Opaque(ciphertext.into()).into()
                    }
                    "Address" => {
                        let value = Self::parse_string_literal(value);
                        let address = Address::from_string(&value).map_err(|e| {
                            JsValue::from_str(&format!("Failed to parse as address value: {}", e))
                        })?;

                        OwnedValue::Opaque(address.into()).into()
                    }
                    "Signature" => {
                        let value = Self::parse_string_literal(value);
                        let signature = Signature::from_hex(&value)
                            .map_err(|_| JsValue::from_str("Failed to parse as signature value"))?;
                        OwnedValue::Opaque(signature.into()).into()
                    }
                    _ => {
                        return Err(JsValue::from_str(&format!(
                            "Unsupported opaque type parsing: {}",
                            name
                        )))
                    }
                }
            }
            Type::Array(inner) => self.parse_array_text(value, inner)?,
            Type::Map(key, value_type) => self.parse_map_text(value, key, value_type)?,
            Type::Struct(ty) => self.parse_struct_text(value, ty)?,
            Type::Enum(ty) => self.parse_enum_text(value, ty)?,
            Type::Tuples(types) => self.parse_tuple_text(value, types)?,
            Type::Closure(_) => {
                self.parse_tuple_text(value, &[Type::U16, Type::Bool, Type::U16])?
            }
            Type::Any | Type::T(_) => self.parse_untyped_text(value)?,
            _ => OwnedValue::Primitive(Self::parse_text_to_primitive(value, param)?),
        })
    }

    pub(super) fn parse_js_value_to_const(
        &self,
        value: JsValue,
        param: &Type,
    ) -> Result<OwnedValue, JsValue> {
        if value.is_null() || value.is_undefined() {
            return match param {
                Type::Optional(_) => Ok(Primitive::Null.into()),
                _ => Err(JsValue::from_str("Expected a parameter value")),
            };
        }

        let value = Self::js_value_to_string(value)?;
        self.parse_text_to_const(&value, param)
    }

    pub fn js_to_storage_preset(&self, js_value: JsValue) -> Result<StoragePreset, JsValue> {
        let storage_preset_json: Result<StoragePresetJSON, serde_wasm_bindgen::Error> =
            serde_wasm_bindgen::from_value(js_value);
        match storage_preset_json {
            Ok(sp_json) => {
                let Some(key_type) = Type::primitive_type_from_byte(sp_json.key_type_id) else {
                    return Err(JsValue::from_str("Invalid key type"));
                };

                let Some(value_type) = Type::primitive_type_from_byte(sp_json.value_type_id) else {
                    return Err(JsValue::from_str("Invalid value type"));
                };

                let storage_key = self
                    .parse_js_value_to_const(JsValue::from_str(sp_json.key.as_str()), &key_type)?;
                let storage_value = self.parse_js_value_to_const(
                    JsValue::from_str(sp_json.value.as_str()),
                    &value_type,
                )?;

                let sp = StoragePreset {
                    key: storage_key,
                    value: storage_value,
                };

                Ok(sp)
            }
            Err(err) => Err(JsValue::from_str(
                format!("Failed to parse storage preset: {}", err).as_str(),
            )),
        }
    }
}
