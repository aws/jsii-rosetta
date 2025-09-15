takes(MyProps.builder()
        .struct(MyLib.SomeStruct.builder()
                .enabled(false)
                .option("option")
                .build())
        .build());