# flydo

This project helps to scaffold an environment where you can run one-off tasks on machines on fly.io.

## Building the binary

The main output of flydo is the `flydo` CLI.

You can build this with `bun compile`.

Place the executable on your path somewhere e.g.
```fish
add_to_path dist/flydo
```

## Getting Started

```sh 
flydo init <directory>
cd <directory>
```

This will scaffold the necessary files and get you ready to run the example provided.

```sh 
flydo run example.ts
```

## New tasks

Tasks are just bun scripts that get run somewhere else.
Create a new one and then run it with `flydo run new-task.ts`. The CLI handles everything else.

