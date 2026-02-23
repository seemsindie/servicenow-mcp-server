import { describe, expect, test } from "bun:test";
import { QueryBuilder, query, joinQueries } from "../../src/utils/query.ts";

describe("QueryBuilder", () => {
  test("equals produces field=value", () => {
    const q = new QueryBuilder().equals("active", "true").build();
    expect(q).toBe("active=true");
  });

  test("notEquals produces field!=value", () => {
    const q = new QueryBuilder().notEquals("state", "7").build();
    expect(q).toBe("state!=7");
  });

  test("like produces fieldLIKEvalue", () => {
    const q = new QueryBuilder().like("short_description", "email").build();
    expect(q).toBe("short_descriptionLIKEemail");
  });

  test("startsWith produces fieldSTARTSWITHvalue", () => {
    const q = new QueryBuilder().startsWith("number", "INC").build();
    expect(q).toBe("numberSTARTSWITHINC");
  });

  test("endsWith produces fieldENDSWITHvalue", () => {
    const q = new QueryBuilder().endsWith("email", "@example.com").build();
    expect(q).toBe("emailENDSWITH@example.com");
  });

  test("isIn produces fieldINvalue1,value2", () => {
    const q = new QueryBuilder().isIn("state", ["1", "2", "3"]).build();
    expect(q).toBe("stateIN1,2,3");
  });

  test("isEmpty produces fieldISEMPTY", () => {
    const q = new QueryBuilder().isEmpty("assigned_to").build();
    expect(q).toBe("assigned_toISEMPTY");
  });

  test("isNotEmpty produces fieldISNOTEMPTY", () => {
    const q = new QueryBuilder().isNotEmpty("assigned_to").build();
    expect(q).toBe("assigned_toISNOTEMPTY");
  });

  test("greaterThan and lessThan", () => {
    const q = new QueryBuilder().greaterThan("priority", 1).build();
    expect(q).toBe("priority>1");
    const q2 = new QueryBuilder().lessThan("priority", 4).build();
    expect(q2).toBe("priority<4");
  });

  test("and() joins with ^", () => {
    const q = new QueryBuilder()
      .equals("active", "true")
      .and()
      .equals("priority", 1)
      .build();
    expect(q).toBe("active=true^priority=1");
  });

  test("or() joins with ^OR", () => {
    const q = new QueryBuilder()
      .equals("state", "1")
      .or()
      .equals("state", "2")
      .build();
    expect(q).toBe("state=1^ORstate=2");
  });

  test("orderBy / orderByDesc", () => {
    const q = new QueryBuilder()
      .equals("active", "true")
      .orderBy("name")
      .build();
    expect(q).toBe("active=trueORDERBYname");

    const q2 = new QueryBuilder()
      .equals("active", "true")
      .orderByDesc("sys_created_on")
      .build();
    expect(q2).toBe("active=trueORDERBYDESCsys_created_on");
  });

  test("where() with arbitrary operator", () => {
    const q = new QueryBuilder().where("priority", ">=", 2).build();
    expect(q).toBe("priority>=2");
  });

  test("chaining multiple conditions", () => {
    const q = new QueryBuilder()
      .equals("active", "true")
      .and()
      .greaterThan("priority", 0)
      .and()
      .like("short_description", "network")
      .orderByDesc("sys_created_on")
      .build();
    expect(q).toBe("active=true^priority>0^short_descriptionLIKEnetworkORDERBYDESCsys_created_on");
  });

  test("and() is a no-op when parts is empty", () => {
    const q = new QueryBuilder().and().equals("x", "1").build();
    expect(q).toBe("x=1");
  });

  test("or() is a no-op when parts is empty", () => {
    const q = new QueryBuilder().or().equals("x", "1").build();
    expect(q).toBe("x=1");
  });
});

describe("query() factory", () => {
  test("returns a new QueryBuilder instance", () => {
    const qb = query();
    expect(qb).toBeInstanceOf(QueryBuilder);
    expect(qb.build()).toBe("");
  });
});

describe("joinQueries()", () => {
  test("joins non-empty strings with ^", () => {
    const result = joinQueries("active=true", "priority=1");
    expect(result).toBe("active=true^priority=1");
  });

  test("filters out undefined and null", () => {
    const result = joinQueries("active=true", undefined, null, "priority=1");
    expect(result).toBe("active=true^priority=1");
  });

  test("returns empty string when all falsy", () => {
    const result = joinQueries(undefined, null, "");
    expect(result).toBe("");
  });

  test("single query returned as-is", () => {
    const result = joinQueries("state=1");
    expect(result).toBe("state=1");
  });
});
