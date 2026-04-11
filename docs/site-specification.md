# Site specification

`SiteSpecSchema` is the boundary between collected facts and presentation code. It validates:

- identity and contact fields;
- services and service areas;
- trust statements and their evidence;
- testimonials and media-rights status;
- pages, sections, theme, search metadata, and forms;
- generation mode, timestamp, and evidence provenance.

The schema is strict: unknown keys are rejected, arrays and text fields are bounded, telephone numbers use E.164, and URLs must parse successfully.

The repository includes a generated JSON Schema and a parity test that compares its validation behavior with the runtime schema for supported cases.

Preview events use a separate strict contract with no fields for raw tokens, network addresses, or prospect contact details. The event factory selects named fields rather than copying arbitrary input metadata. Callers still need to keep sensitive values out of the permitted identifier fields.
