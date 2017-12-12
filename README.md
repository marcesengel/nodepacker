# nodepacker

## Why?
I wrote this tool to be able to ship Node.JS code in a single file. There are other alternatives (like webpack), but most of them are built for web, have millions of plugins and support CSS etc., which isn't needed for pure Node.JS applications.

**`nodepacker` also enables you to use [Uglify V3](https://github.com/mishoo/UglifyJS2) on your application code, making it harder for others to "take away from you", what you've worked for many hours of your life.**

## Installation
```
npm install -g https://github.com/DragonRaider5/nodepacker
```

## Usage
As a command line tool:
```
nodepacker ./index.js > output.js
```

This will bundle `index.js` and all it's dependencies (which aren't installed via npm) and print the output to the file `output.js`.

## Contribution
If you want to contribute, feel free to open a pull request containing a desrciption and your changes. There are a lot of known bugs where I simply have not taken care of fixing them yet, every help is welcome.

#### Known Bugs
- Can't handle strings marked with double quotes ("), currently only single quotes are supported (') \[in your application code\]
- Can't handle nested strings
