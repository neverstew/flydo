# flydo

This project helps to scaffold an environment where you can run one-off tasks on machines on fly.io.

It basically only works for my setup right now, but it would be easily adaptable. PRs welcome.

## Requirements
This only works right now with:
- [bun](https://bun.sh)
- [podman](https://podman.io)
- [flyctl](https://fly.io/docs/flyctl/)

## Building the binary

The main output of flydo is the `flydo` CLI.

You can build this with `bun compile`.

Place the executable on your path somewhere e.g. in a fish shell
```fish
add_to_path dist/flydo
```

## Getting Started

Inside an existing fly app directory, run

```sh 
flydo init <directory>
cd <directory>
```

This will scaffold the necessary files and get you ready to run the example provided.

```sh 
flydo run example.ts
```

## New tasks

Tasks are just bun scripts that get run somewhere else.
Create a new one and then run it with `flydo run new-task.ts`. The CLI handles everything else.

## Other languages

There's nothing stopping you from running scripts in any language.
The docker image would need the requirements to be installed and you'd need to adapt the CLI to accept the full command to run in the image.
Any PRs to do this would be cool.

