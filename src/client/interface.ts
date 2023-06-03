export const clientInterface = (name: string) =>
  /* xml */ `
<node>
  <interface name="${name}">
    <method name="Terminate">
    </method>
    <method name="LoadImport">
      <arg type="s" name="importPath"/>
    </method>
    <method name="ActionError">
      <arg type="s" name="actionID"/>
      <arg type="s" name="error"/>
    </method>
    <method name="ActionResult">
      <arg type="s" name="actionID"/>
      <arg type="s" name="result"/>
    </method>
    <method name="Invoke">
      <arg type="s" name="actionID"/>
      <arg type="s" name="functionName"/>
      <arg type="s" name="arguments"/>
    </method>
  </interface>
</node>
` as const;
