def foo(x, outer)
end

foo(25, {
    foo: 3,
    deeper: {
        a: 1,
        b: 2,
    },
})