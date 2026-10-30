---
title: Built-in patterns
description: The kinds of detail Ebon can look for, what each pattern matches, and where it can be wrong.
order: 5
---

Patterns find candidates. You decide in the review step. A pattern can match things that are not what you meant, and can miss unusual layouts.

{{patterns-table}}

## Sources for the Irish formats

- **Eircode:** a seven-character code in two parts, a three-character routing key and a four-character unique identifier, using letters and numbers but not the letter O ([Eircode](https://www.eircode.ie/what-is-eircode)). The pattern does not check the list of routing keys, so it can match other codes.
- **PPS number:** seven digits followed by one or two letters. The newer format has two letters, the older one or two. Sources disagree on the rules for the letters, so the pattern accepts any one or two. See the [Microsoft Purview definition](https://learn.microsoft.com/en-NZ/purview/sit-defn-ireland-personal-public-service-number), [Wikipedia](https://en.wikipedia.org/wiki/Personal_Public_Service_Number) and the [python-stdnum documentation](https://arthurdejong.org/python-stdnum/doc/2.0/stdnum.ie.pps). The pattern matches only a number written without spaces.
- **IBAN:** checked with the standard check digits (the first four characters are moved to the end, letters become numbers, and the number must leave a remainder of 1 when divided by 97).
- **Payment card numbers:** 13 to 19 digits that pass the Luhn check.

## Your own patterns

A search line written between slashes is used as a regular expression, for example `/case\s?\d{4,}/`. The expression is applied to the text of each page. A pattern that cannot be read is reported before the search starts.

## Matching rules for words

- Words are matched without regard to upper or lower case, unless you switch that on.
- Seán and Sean match each other, unless you switch that off. This works by removing accents from letters, one letter at a time.
- With whole words on, a search for Ann finds Ann and not Annie.
- A term of two words matches across any run of spaces or a line break.
