namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>Ejadah letterhead and stamp shipped with the invoice PDF (same assets as the official letters).</summary>
internal static class OfficialLetterAssets
{
    internal static readonly byte[] Letterhead = Read("ejadah-letterhead.png");
    internal static readonly byte[] Stamp = Read("ejadah-stamp.png");
    /// <summary>The report approver's signature, same image the case-study report prints.</summary>
    internal static readonly byte[] Signature = Read("emad-signature.png");

    private static byte[] Read(string fileName)
    {
        var asm = typeof(OfficialLetterAssets).Assembly;
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase));
        if (name is null) return [];
        using var stream = asm.GetManifestResourceStream(name);
        if (stream is null) return [];
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
