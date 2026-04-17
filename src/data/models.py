"""SQLAlchemy ORM models for HorseGPT v3.14.

Schema designed around BRIS data format. Entry is the central table —
one row per horse per race, the unit of prediction.
"""

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Race(Base):
    __tablename__ = "races"

    id: Mapped[int] = mapped_column(primary_key=True)
    track_code: Mapped[str] = mapped_column(String(5), index=True)
    race_date: Mapped[date] = mapped_column(Date, index=True)
    race_number: Mapped[int] = mapped_column(Integer)
    # Nullable: ingest refuses to fabricate defaults for missing race attributes.
    distance_yards: Mapped[int | None] = mapped_column(Integer, nullable=True)
    surface: Mapped[str | None] = mapped_column(String(10), nullable=True)  # D, T, AW
    race_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    purse: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claiming_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    track_condition: Mapped[str | None] = mapped_column(String(5), nullable=True)
    num_entrants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    race_class: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Fractional times for the race leader
    fraction_1: Mapped[float | None] = mapped_column(Float, nullable=True)
    fraction_2: Mapped[float | None] = mapped_column(Float, nullable=True)
    fraction_3: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("track_code", "race_date", "race_number", name="uq_race"),
        Index("ix_race_lookup", "track_code", "race_date"),
    )

    entries: Mapped[list["Entry"]] = relationship(back_populates="race", cascade="all, delete-orphan")


class Horse(Base):
    __tablename__ = "horses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    sire: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dam_sire: Mapped[str | None] = mapped_column(String(100), nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(5), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    entries: Mapped[list["Entry"]] = relationship(back_populates="horse")
    workouts: Mapped[list["Workout"]] = relationship(back_populates="horse")


class Entry(Base):
    """A horse's entry in a specific race — the central prediction unit."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id"), index=True)
    horse_id: Mapped[int] = mapped_column(ForeignKey("horses.id"), index=True)

    # Pre-race info. post_position is required (it's the in-race identifier);
    # ingest skips entries that lack it rather than coercing to 0.
    post_position: Mapped[int] = mapped_column(Integer)
    program_number: Mapped[str | None] = mapped_column(String(5), nullable=True)
    jockey: Mapped[str | None] = mapped_column(String(100), nullable=True)
    trainer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    medication: Mapped[str | None] = mapped_column(String(10), nullable=True)
    equipment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    claiming_price: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Odds
    morning_line_odds: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_odds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # BRIS speed/pace figures for today
    bris_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bris_class_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bris_pace_e1: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bris_pace_e2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bris_late_pace: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Running style classification (E, EP, P, S, C)
    running_style: Mapped[str | None] = mapped_column(String(5), nullable=True)

    # Result columns (filled after race)
    finish_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    beyer_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Running positions at each call
    position_1st_call: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_2nd_call: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_stretch: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Lengths behind at each call
    lengths_behind_1st: Mapped[float | None] = mapped_column(Float, nullable=True)
    lengths_behind_2nd: Mapped[float | None] = mapped_column(Float, nullable=True)
    lengths_behind_stretch: Mapped[float | None] = mapped_column(Float, nullable=True)
    lengths_behind_finish: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Win/place/show payoffs
    win_payoff: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_payoff: Mapped[float | None] = mapped_column(Float, nullable=True)
    show_payoff: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("race_id", "post_position", name="uq_entry"),
    )

    race: Mapped["Race"] = relationship(back_populates="entries")
    horse: Mapped["Horse"] = relationship(back_populates="entries")
    past_performances: Mapped[list["PastPerformance"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan"
    )


class PastPerformance(Base):
    """Denormalized past performance lines from BRIS data.

    Each row is one prior race for one entry, as it appeared in
    the BRIS file. Up to 10 PPs per entry. Denormalized to avoid
    expensive self-joins during feature engineering.
    """

    __tablename__ = "past_performances"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id"), index=True)
    pp_number: Mapped[int] = mapped_column(Integer)  # 1 = most recent, up to 10

    # Race info
    race_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    track_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    distance_yards: Mapped[int | None] = mapped_column(Integer, nullable=True)
    surface: Mapped[str | None] = mapped_column(String(10), nullable=True)
    track_condition: Mapped[str | None] = mapped_column(String(5), nullable=True)
    race_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    purse: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claiming_price: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Result
    finish_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_entrants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_odds: Mapped[float | None] = mapped_column(Float, nullable=True)
    beyer_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Pace figures
    e1_pace: Mapped[int | None] = mapped_column(Integer, nullable=True)
    e2_pace: Mapped[int | None] = mapped_column(Integer, nullable=True)
    late_pace: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Running line
    position_1st_call: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_2nd_call: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position_stretch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lengths_behind_1st: Mapped[float | None] = mapped_column(Float, nullable=True)
    lengths_behind_finish: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Additional
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    final_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    entry: Mapped["Entry"] = relationship(back_populates="past_performances")


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    horse_id: Mapped[int] = mapped_column(ForeignKey("horses.id"), index=True)
    # Workout requires date, distance, and time; ingest skips rows missing any.
    workout_date: Mapped[date] = mapped_column(Date)
    track_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    distance_furlongs: Mapped[float] = mapped_column(Float)
    time_seconds: Mapped[float] = mapped_column(Float)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_workers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bullet: Mapped[bool | None] = mapped_column(nullable=True)
    surface: Mapped[str | None] = mapped_column(String(10), nullable=True)

    horse: Mapped["Horse"] = relationship(back_populates="workouts")
