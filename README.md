# CSS To Tailwind

Convert CSS to [TailwindCSS](https://github.com/tailwindlabs/tailwindcss) classes.

## Usage

`npx css-to-tailwind ".logo { margin-bottom: 1.6rem; min-height: 4rem; display: flex; justify-content: center; }"`

The package also offers a Node API. Using that you can use custom TailwindCSS configs as well. I don't have time to document it, but reading these two PRs should clarify everything:
1. [Introducing css-to-tailwind to transform.tools](https://github.com/ritz078/transform/pull/243)
2. [Adding custom config support to transform.tools](https://github.com/ritz078/transform/pull/235)

TailwindCSS can't run in a browser, because it depends on Node APIs, however this project can, if you use `css-to-tailwind/browser`. In this case, you have to run TailwindCSS on the server side, if you want to use a custom Tailwind config. See the second PR above for details.

## Output

`Array<{ selector: string, tailwind: string, missing: Array<Array<CSSProperty, CSSValue>>}>`

- `selector`: The selector used in the input CSS.
- `tailwind`: List of TailwindCSS classes in a single string, separated by a space.
- `missing`: The properties that can't be converted, will appear as an array of tuples.

```
[
  {
    "selector": ".logo",
    "tailwind": "flex justify-center mb-6",
    "missing": [
      [
        "min-height",
        "4rem"
      ]
    ]
  }
]
```

## License

MIT
