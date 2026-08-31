# Notes model

A Lumen note has a title, a Markdown body, a visibility flag, and an optional
collection. Visibility is `private` or `workspace`.

## Private notes on Free

On the Free plan, private notes remain editable only while the workspace is
under the billing cap of 50 notes. After the cap, private notes are readable
but the editor locks. This behavior is owned by billing, not by the notes
schema.

Workspace notes are always visible to every accepted member. They are indexed
for retrieval. Private notes are indexed only on the author's device.

## Collections

Collections are folders without nesting. A note belongs to at most one
collection. Moving a note does not change its visibility or its line-span
identity inside the retrieval index.

## Attachments

Images and PDFs can be attached to Pro and Team notes. Attachments are not
chunked for retrieval in v1. Only Markdown, text, HTML, JSON, and source
files enter the index.
