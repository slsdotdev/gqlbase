# 0008 — Polymorphic relations: a hidden discriminator, unions and interfaces alike

- **Date:** 2026-10-04
- **Status:** accepted
- **Proposal:** `polymorphic-relations.md`

## Context

A relation to a union or an interface was accepted by the transform but not usable end to end: keys on members were always non-null, interface keys landed on the interface only, there was no column saying which member a row points at, and the dsqlbase generator threw. dsqlbase 0.2.0 relates to a `union()` of tables: a belongs-to stores a text discriminator holding the member's schema alias, and with global ids a written id fills it and a filter by id matches both columns.

## Decision

- **A `@belongsTo` to a union or an interface stores two hidden fields**: the key and `<field>Type` (`discriminator:` renames it), both `@serverOnly @writeOnly`. The discriminator holds the member's schema alias, as dsqlbase stores it.
- **Interfaces are unions** of their stored implementors: keys go on every member, never on the interface.
- **No reference input.** A public `<field>Id: GUID` is the whole reference: the id names its member. Members cannot mix `GUID` ids with others.
- **dsqlbase:** a `union()` per union or interface a relation targets, `belongsTo(union, { discriminator })` with a keyless `guid()` key, and per-member keys for `hasOne` / `hasMany`.
- **A member's reverse relation correlates on the id alone**, as dsqlbase does. A resolver that filters by the parent's global id matches the discriminator too.

Rejected:
- The GraphQL type name as the discriminator value: dsqlbase stores the member alias, as global ids do.
- A public discriminator enum and a generated `@oneOf` reference input (from the request): a `GUID` id names its member.
- Holding member-side relations until dsqlbase can pin the discriminator: random uuids make a cross-member collision practically impossible, and the resolver filter is exact.
- A `union()` for every union of tables: only relation targets need one.

## Consequences

- `minor`. Union-member keys follow the relation's nullability (they were always non-null); interface keys move from the interface to its implementors.
- dsqlbase's create types require the discriminator although a global id fills it at runtime; resolvers derive it from the id with `decodeGlobalId` until dsqlbase relaxes the type.
- Filters on a `@hasMany` to a union (shared fields) are not generated.

## Docs

- [Relations → Union and interface targets](../guide/relations.md#union-and-interface-targets)
- [dsqlbase → Polymorphic relations](../guide/dsqlbase.md#polymorphic-relations)
