export const serverInterface = (name: string) =>
  /* xml */ `
<node>
  <interface name="${name}">
    <method name="SubprocessReady">
      <arg type="s" name="clientName"/>
    </method>
    <method name="ModuleLoaded">
      <arg type="s" name="clientName"/>
    </method>
    <method name="LoadError">
      <arg type="s" name="clientName"/>
      <arg type="s" name="error"/>
    </method>
    <method name="ActionError">
      <arg type="s" name="clientName"/>
      <arg type="s" name="actionID"/>
      <arg type="s" name="error"/>
    </method>
    <method name="ActionResult">
      <arg type="s" name="clientName"/>
      <arg type="s" name="actionID"/>
      <arg type="s" name="result"/>
    </method>
    <method name="Invoke">
      <arg type="s" name="clientName"/>
      <arg type="s" name="actionID"/>
      <arg type="s" name="functionName"/>
      <arg type="s" name="arguments"/>
    </method>
    <method name="GetResult">
      <arg type="s" name="clientName"/>
      <arg type="s" name="actionID"/>
      <arg type="s" name="result"/>
    </method>
  </interface>
</node>
` as const;
