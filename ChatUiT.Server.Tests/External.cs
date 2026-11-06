namespace External.Library;

/// <summary>Throws from outside the ChatUiT namespaces, as a library would.</summary>
public static class Thrower
{
    public static void Throw(Exception exception) => throw exception;
}
