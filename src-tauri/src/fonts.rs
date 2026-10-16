//! Fontes instaladas no computador, para a escolha da fonte do app (Preferências → Fonte).

/// Nomes das famílias de fonte instaladas, em ordem alfabética e sem repetição.
pub fn system_families() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    // a primeira família de cada face é o nome em inglês, o que o CSS reconhece
    unique_sorted(db.faces().filter_map(|f| f.families.first().map(|(name, _)| name.clone())))
}

/// Ordena sem diferenciar maiúsculas e tira nomes vazios, ocultos (".SF…") e repetidos.
pub fn unique_sorted(names: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut v: Vec<String> = names
        .into_iter()
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty() && !n.starts_with('.'))
        .collect();
    v.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()).then_with(|| a.cmp(b)));
    v.dedup_by(|a, b| a.to_lowercase() == b.to_lowercase());
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordena_e_tira_repetidos() {
        let names = ["Ubuntu", "dejavu sans", "DejaVu Sans", " Arial ", "", ".SF NS", "Ubuntu"].map(String::from);
        assert_eq!(unique_sorted(names), vec!["Arial", "DejaVu Sans", "Ubuntu"]);
    }

    #[test]
    fn lista_do_sistema_ja_vem_limpa() {
        let fams = system_families();
        assert_eq!(fams, unique_sorted(fams.clone()));
    }
}
