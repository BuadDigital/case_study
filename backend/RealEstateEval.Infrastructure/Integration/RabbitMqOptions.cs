namespace RealEstateEval.Infrastructure.Integration;

public sealed class RabbitMqOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "dev";
    public string Password { get; set; } = "dev";
    public string VirtualHost { get; set; } = "/";
    public string Exchange { get; set; } = "realestate-eval.events";
    public bool Enabled { get; set; } = true;
}
